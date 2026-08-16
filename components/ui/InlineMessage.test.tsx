import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InlineMessage } from "./InlineMessage";

describe("InlineMessage", () => {
  it("infoバリアントはnoteロールで表示される", () => {
    render(<InlineMessage variant="info" message="共有するメモはAIへ送信されます" />);
    expect(screen.getByRole("note")).toHaveTextContent("共有するメモはAIへ送信されます");
  });

  it("warningバリアントはalertロールで表示される", () => {
    render(<InlineMessage variant="warning" message="過去に送信済みの内容は取り消せません" />);
    expect(screen.getByRole("alert")).toHaveTextContent("過去に送信済みの内容は取り消せません");
  });
});
