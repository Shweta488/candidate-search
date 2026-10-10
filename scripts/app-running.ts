// Stops a script with a clear message when the app isn't running, instead of a
// "fetch failed" stack trace from the first request.
export async function requireRunningApp(appUrl: string): Promise<void> {
  try {
    await fetch(`${appUrl}/api/plan`); // any answer, even 401, means the app is up
  } catch {
    console.error(`The app isn't running on ${appUrl}. Start it with make dev, then run this again.`);
    process.exit(1);
  }
}
