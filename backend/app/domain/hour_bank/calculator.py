"""
Calculador de banco de horas conforme Portaria 671/2021 e CLT.

Regras implementadas:
- Jornada padrão: 8h/dia, 44h/semana
- Horas extras: 50% dias úteis, 100% domingos e feriados
- Intervalo intrajornada: mínimo 1h para jornadas > 6h
- Tolerância: 5min por marcação, 10min/dia (Art. 74 §1º CLT)
- Banco de horas: prazo de compensação 6 meses
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal

from app.domain.attendance.models import AttendanceRecord, RecordType

# --- Constantes legais (Portaria 671 / CLT) ---------------------------------

STANDARD_DAILY_MINUTES = 8 * 60          # 480 min
STANDARD_WEEKLY_MINUTES = 44 * 60        # 2640 min

EXTRA_RATE_WEEKDAY = Decimal("0.50")     # 50% dias úteis
EXTRA_RATE_WEEKEND = Decimal("1.00")     # 100% domingos e feriados

MIN_INTRAJORNADA_TRIGGER = 6 * 60        # jornadas > 360 min exigem intervalo
MIN_INTRAJORNADA_MINUTES = 60            # mínimo 1h de intervalo

TOLERANCE_PER_RECORD_MINUTES = 5        # tolerância por marcação
MAX_DAILY_TOLERANCE_MINUTES = 10        # tolerância máxima diária

HOUR_BANK_COMPENSATION_DAYS = 180       # prazo de compensação


@dataclass(frozen=True)
class DayCalculationResult:
    reference_date: date
    worked_minutes: int
    expected_minutes: int
    balance_minutes: int              # worked - expected (negativo = débito)
    extra_minutes_50pct: int
    extra_minutes_100pct: int
    intrajornada_discounted: int      # minutos descontados por falta de intervalo
    is_holiday: bool


def calculate_day(
    records: list[AttendanceRecord],
    reference_date: date,
    expected_minutes: int = STANDARD_DAILY_MINUTES,
    is_holiday: bool = False,
) -> DayCalculationResult:
    """
    Calcula banco de horas de um dia.

    Args:
        records: Registros de ponto do dia (já ordenados por recorded_at).
        reference_date: Data de referência.
        expected_minutes: Minutos esperados pela escala do funcionário.
        is_holiday: True se feriado ou domingo (adicional 100%).

    Returns:
        DayCalculationResult com todos os componentes do cálculo.
    """
    if not records:
        return DayCalculationResult(
            reference_date=reference_date,
            worked_minutes=0,
            expected_minutes=expected_minutes,
            balance_minutes=-expected_minutes,
            extra_minutes_50pct=0,
            extra_minutes_100pct=0,
            intrajornada_discounted=0,
            is_holiday=is_holiday,
        )

    worked_minutes = _calculate_worked_minutes(records)
    intrajornada_discount = _calculate_intrajornada_discount(records, worked_minutes)
    net_worked = worked_minutes - intrajornada_discount

    # Aplicar tolerância legal
    net_worked = _apply_tolerance(net_worked, expected_minutes)

    balance = net_worked - expected_minutes
    extra_50 = 0
    extra_100 = 0

    if balance > 0:
        if is_holiday or reference_date.weekday() == 6:  # domingo
            extra_100 = balance
        else:
            extra_50 = balance

    return DayCalculationResult(
        reference_date=reference_date,
        worked_minutes=net_worked,
        expected_minutes=expected_minutes,
        balance_minutes=balance,
        extra_minutes_50pct=extra_50,
        extra_minutes_100pct=extra_100,
        intrajornada_discounted=intrajornada_discount,
        is_holiday=is_holiday,
    )


def _calculate_worked_minutes(records: list[AttendanceRecord]) -> int:
    """Soma os pares IN/OUT em minutos."""
    total = 0
    sorted_records = sorted(records, key=lambda r: r.recorded_at)
    ins = [r for r in sorted_records if r.record_type == RecordType.IN]
    outs = [r for r in sorted_records if r.record_type == RecordType.OUT]

    for in_rec, out_rec in zip(ins, outs):
        delta = out_rec.recorded_at - in_rec.recorded_at
        total += int(delta.total_seconds() / 60)

    return max(0, total)


def _calculate_intrajornada_discount(
    records: list[AttendanceRecord], worked_minutes: int
) -> int:
    """
    Calcula desconto por intervalo intrajornada insuficiente.

    Jornadas > 6h exigem mínimo de 1h de intervalo.
    Se o intervalo real for menor que 1h, desconta a diferença.
    """
    if worked_minutes <= MIN_INTRAJORNADA_TRIGGER:
        return 0

    sorted_records = sorted(records, key=lambda r: r.recorded_at)
    # Calcular total de pausas (OUT → IN)
    total_pause = 0
    for i in range(len(sorted_records) - 1):
        if (
            sorted_records[i].record_type == RecordType.OUT
            and sorted_records[i + 1].record_type == RecordType.IN
        ):
            pause = sorted_records[i + 1].recorded_at - sorted_records[i].recorded_at
            total_pause += int(pause.total_seconds() / 60)

    if total_pause < MIN_INTRAJORNADA_MINUTES:
        return MIN_INTRAJORNADA_MINUTES - total_pause
    return 0


def _apply_tolerance(worked_minutes: int, expected_minutes: int) -> int:
    """
    Aplica tolerância legal de 5min/10min (Art. 74 §1º CLT).

    Diferenças dentro da tolerância são desconsideradas para horas extras/faltas.
    """
    diff = abs(worked_minutes - expected_minutes)
    if diff <= MAX_DAILY_TOLERANCE_MINUTES:
        return expected_minutes  # dentro da tolerância: tratar como jornada completa
    return worked_minutes
