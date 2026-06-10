import { describe, expect, it } from "vitest";
import { isDisposableEmail } from "./disposableEmailDomains";
import { emailDomain, normalizeEmail } from "./emailNormalization";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  John.Doe@Example.COM ")).toBe("john.doe@example.com");
  });

  it("collapses gmail dots and + aliases to one identity", () => {
    const canonical = "johndoe@gmail.com";
    expect(normalizeEmail("john.doe@gmail.com")).toBe(canonical);
    expect(normalizeEmail("j.o.h.n.d.o.e@gmail.com")).toBe(canonical);
    expect(normalizeEmail("johndoe+newsletter@gmail.com")).toBe(canonical);
    expect(normalizeEmail("John.Doe+spam@googlemail.com")).toBe("johndoe@googlemail.com");
  });

  it("strips + aliases but keeps dots for outlook/yahoo/icloud/proton/fastmail", () => {
    expect(normalizeEmail("jane.doe+tag@outlook.com")).toBe("jane.doe@outlook.com");
    expect(normalizeEmail("jane.doe+tag@yahoo.com")).toBe("jane.doe@yahoo.com");
    expect(normalizeEmail("jane.doe+tag@icloud.com")).toBe("jane.doe@icloud.com");
    expect(normalizeEmail("jane.doe+tag@proton.me")).toBe("jane.doe@proton.me");
    expect(normalizeEmail("jane.doe+tag@fastmail.com")).toBe("jane.doe@fastmail.com");
  });

  it("leaves unknown domains untouched except for case (keeps dots and +)", () => {
    expect(normalizeEmail("a.b+tag@company.co")).toBe("a.b+tag@company.co");
  });

  it("never merges Apple Private Relay addresses", () => {
    // Two distinct relay addresses must stay distinct. They are different users.
    expect(normalizeEmail("abc123+x@privaterelay.appleid.com")).toBe(
      "abc123+x@privaterelay.appleid.com",
    );
    expect(normalizeEmail("a.b.c@privaterelay.appleid.com")).toBe(
      "a.b.c@privaterelay.appleid.com",
    );
    expect(normalizeEmail("ABC123@privaterelay.appleid.com")).toBe(
      "abc123@privaterelay.appleid.com",
    );
  });

  it("returns the input lowercased when there is no @", () => {
    expect(normalizeEmail("NotAnEmail")).toBe("notanemail");
  });
});

describe("emailDomain", () => {
  it("returns the lowercased domain", () => {
    expect(emailDomain("User+x@Gmail.com")).toBe("gmail.com");
  });

  it("returns undefined when there is no @", () => {
    expect(emailDomain("nope")).toBeUndefined();
  });
});

describe("isDisposableEmail", () => {
  it("flags known disposable domains case-insensitively", () => {
    expect(isDisposableEmail("foo@Mailinator.com")).toBe(true);
    expect(isDisposableEmail("foo@guerrillamail.com")).toBe(true);
  });

  it("does not flag real providers or Apple Private Relay", () => {
    expect(isDisposableEmail("foo@gmail.com")).toBe(false);
    expect(isDisposableEmail("foo@privaterelay.appleid.com")).toBe(false);
    expect(isDisposableEmail("not-an-email")).toBe(false);
  });
});
