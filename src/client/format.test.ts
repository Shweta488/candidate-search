import { seniorityLabel, yearRange, yearsText } from "./format";

describe("format", () => {
  it("labels seniority", () => {
    expect(seniorityLabel("mid")).toBe("Mid-level");
    expect(seniorityLabel("principal")).toBe("principal");
  });

  it("says year or years", () => {
    expect(yearsText(1)).toBe("1 year");
    expect(yearsText(0)).toBe("0 years");
  });

  it("writes a job's years", () => {
    expect(yearRange(2023, null)).toBe("2023 to present");
    expect(yearRange(2022, 2023)).toBe("2022 to 2023");
    expect(yearRange(2021, 2021)).toBe("2021");
  });
});
