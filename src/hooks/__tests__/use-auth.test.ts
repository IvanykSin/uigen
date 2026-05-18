import { test, expect, vi, beforeEach, afterEach, describe } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: any[]) => mockSignInAction(...args),
  signUp: (...args: any[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: any[]) => mockCreateProject(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

afterEach(() => {
  cleanup();
});

describe("useAuth — initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("useAuth — signIn", () => {
  test("sets isLoading to true while signing in and false after", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());

    let signInPromise: Promise<any>;
    act(() => {
      signInPromise = result.current.signIn("user@example.com", "password");
    });
    // isLoading should be true immediately after call
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await signInPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("calls signInAction with the provided credentials", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "secret");
    });

    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "secret");
  });

  test("returns the result from signInAction", async () => {
    const serverResult = { success: false, error: "Invalid credentials" };
    mockSignInAction.mockResolvedValue(serverResult);

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@example.com", "wrong");
    });

    expect(returnValue).toEqual(serverResult);
  });

  test("does not navigate when signIn fails", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Bad password" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "wrong");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("isLoading returns to false even when signInAction throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("useAuth — signUp", () => {
  test("sets isLoading to true while signing up and false after", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

    const { result } = renderHook(() => useAuth());

    let signUpPromise: Promise<any>;
    act(() => {
      signUpPromise = result.current.signUp("new@example.com", "pass123");
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await signUpPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("calls signUpAction with the provided credentials", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email taken" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("taken@example.com", "pass123");
    });

    expect(mockSignUpAction).toHaveBeenCalledWith("taken@example.com", "pass123");
  });

  test("returns the result from signUpAction", async () => {
    const serverResult = { success: false, error: "Email already in use" };
    mockSignUpAction.mockResolvedValue(serverResult);

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("taken@example.com", "pass");
    });

    expect(returnValue).toEqual(serverResult);
  });

  test("does not navigate when signUp fails", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email taken" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("taken@example.com", "pass");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("isLoading returns to false even when signUpAction throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("user@example.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("useAuth — post sign-in routing: anonymous work exists", () => {
  test("creates a project from anon work and navigates to it", async () => {
    const anonWork = {
      messages: [{ role: "user", content: "Hello" }],
      fileSystemData: { "/": { type: "directory" } },
    };
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
  });

  test("project name includes a time string", async () => {
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "Hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "x" });
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    const call = mockCreateProject.mock.calls[0][0];
    expect(call.name).toMatch(/Design from/);
  });

  test("does not call getProjects when anon work is present", async () => {
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "Hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "x" });
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
  });
});

describe("useAuth — post sign-in routing: no anonymous work, existing projects", () => {
  test("navigates to the most recent project", async () => {
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "recent-proj" }, { id: "older-proj" }]);
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent-proj");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

describe("useAuth — post sign-in routing: no anonymous work, no existing projects", () => {
  test("creates a new project and navigates to it", async () => {
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-id" });
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
  });

  test("new project name matches expected pattern", async () => {
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "x" });
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    const call = mockCreateProject.mock.calls[0][0];
    expect(call.name).toMatch(/^New Design #\d+$/);
  });
});

describe("useAuth — post sign-in routing: empty anon work (0 messages)", () => {
  test("treats anon work with 0 messages as no anon work and falls through to projects", async () => {
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }]);
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });
});

describe("useAuth — signUp post-auth routing", () => {
  test("applies same anon-work logic after successful signUp", async () => {
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "Hello" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "signup-anon-proj" });
    mockSignUpAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "pass");
    });

    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/signup-anon-proj");
  });

  test("navigates to most recent project after signUp when no anon work", async () => {
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "user-proj" }]);
    mockSignUpAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/user-proj");
  });
});
