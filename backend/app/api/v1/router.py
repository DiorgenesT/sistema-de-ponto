from fastapi import APIRouter

from app.api.v1.routes import auth, attendance, employees, devices, hour_bank, justifications, reports, schedules

router = APIRouter()

router.include_router(auth.router,           prefix="/auth",           tags=["auth"])
router.include_router(attendance.router,     prefix="/attendance",     tags=["attendance"])
router.include_router(employees.router,      prefix="/employees",      tags=["employees"])
router.include_router(devices.router,        prefix="/devices",        tags=["devices"])
router.include_router(hour_bank.router,      prefix="/hour-bank",      tags=["hour-bank"])
router.include_router(justifications.router, prefix="/justifications", tags=["justifications"])
router.include_router(reports.router,        prefix="/reports",        tags=["reports"])
router.include_router(schedules.router,      prefix="/schedules",      tags=["schedules"])
