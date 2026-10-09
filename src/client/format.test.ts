import { peopleText, seniorityLabel, shortDate, yearRange, yearsText } from "./format";

describe("format", () => {
  it("labels seniority", () => {
    expect(seniorityLabel("mid")).toBe("Mid-level");
    expect(seniorityLabel("principal")).toBe("principal");
  });

  it("says year or years", () => {
    expect(yearsText(1)).toBe("1 year");
    expect(yearsText(0)).toBe("0 years");
  });

  it("writes dates and counts", () => {
    expect(shortDate("2026-10-09T12:00:00Z")).toBe("Oct 9, 2026");
    expect(peopleText(1)).toBe("1 person");
    expect(peopleText(3)).toBe("3 people");
  });

  it("writes a job's years", () => {
    expect(yearRange(2023, null)).toBe("2023 to present");
    expect(yearRange(2022, 2023)).toBe("2022 to 2023");
    expect(yearRange(2021, 2021)).toBe("2021");
  });
});
