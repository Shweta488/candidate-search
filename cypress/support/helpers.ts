export const PASSWORD = "demo-password";

export const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
] as const;

export function signIn(email: string, password = PASSWORD): void {
  cy.get("#email").clear().type(email);
  cy.get("#password").clear().type(password, { log: false });
  cy.contains("button", "Sign in").click();
}

// WCAG 2.1 A and AA rules (NFR9).
export function checkAccessibility(): void {
  cy.injectAxe();
  cy.checkA11y(undefined, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
}
