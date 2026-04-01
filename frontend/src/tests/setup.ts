import "@testing-library/jest-dom";

// Mock face-api.js em testes — não carregar modelos pesados
vi.mock("face-api.js", () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: vi.fn() },
    faceLandmark68TinyNet: { loadFromUri: vi.fn() },
  },
  TinyFaceDetectorOptions: vi.fn(),
  detectSingleFace: vi.fn().mockReturnValue({
    withFaceLandmarks: vi.fn().mockResolvedValue(null),
  }),
}));
