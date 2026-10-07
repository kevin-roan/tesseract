import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FieldGroup } from "./FieldGroup";
import { FormDialog } from "./FormDialog";
import { FormEntry } from "./FormEntry";
import { FormField } from "./FormField";
import { useFormState } from "./use-form-state";
import { skipMotionInTests } from "../DialogShell/skip-motion";

function renderForm(props: Partial<Parameters<typeof FormDialog>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <FormDialog title="Rename" submitLabel="Save" cancelLabel="Cancel" onSubmit={onSubmit} onClose={onClose} {...props}>
      <FieldGroup description="Hint" errors={["Bad name"]}>
        <FormField label="Name">
          <FormEntry password />
        </FormField>
      </FieldGroup>
    </FormDialog>,
  );
  return { onSubmit, onClose };
}


let restoreMotion: () => void;
beforeAll(() => {
  restoreMotion = skipMotionInTests();
});
afterAll(() => restoreMotion());

describe("FormDialog", () => {
  it("submits through the primary button and Enter", () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.submit(screen.getByLabelText("Name").closest("form") as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("cancels with the flat button", () => {
    const { onClose } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("ignores submit, disables fields and shows a spinner while busy", () => {
    const { onSubmit } = renderForm({ busy: true });
    fireEvent.submit(screen.getByLabelText("Name").closest("form") as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("form-busy")).toBeTruthy();
    expect(screen.getByLabelText("Name").closest("fieldset")?.disabled).toBe(true);
  });

  it("shows the subtitle, the error notice and group errors", () => {
    renderForm({ subtitle: "Sub", error: "Boom" });
    expect(screen.getByText("Sub")).toBeTruthy();
    expect(screen.getByText("Boom")).toBeTruthy();
    expect(screen.getByText("Bad name")).toBeTruthy();
    expect(screen.getByText("Hint")).toBeTruthy();
  });

  it("toggles the password peek", () => {
    renderForm();
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show text" }));
    expect(input.type).toBe("text");
  });
});

describe("useFormState", () => {
  it("clears a field error when the field changes and resets", () => {
    const { result } = renderHook(() => useFormState({ pin: "", repeat: "" }));
    act(() => result.current.fail({ pin: "Invalid", repeat: "Mismatch" }));
    expect(result.current.errorsFor("pin", "repeat")).toEqual(["Invalid", "Mismatch"]);
    act(() => result.current.field("pin").onChange({ target: { value: "12" } } as never));
    expect(result.current.values.pin).toBe("12");
    expect(result.current.errors.pin).toBeUndefined();
    expect(result.current.field("repeat").error).toBe(true);
    act(() => result.current.reset());
    expect(result.current.values).toEqual({ pin: "", repeat: "" });
    expect(result.current.errors).toEqual({});
  });
});
