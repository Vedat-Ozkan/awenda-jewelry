import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins rows and quotes special characters", () => {
    expect(toCsv([["a", "b,c"], ['say "hi"', "x\ny"]])).toBe('a,"b,c"\n"say ""hi""","x\ny"');
  });

  it("neutralises formula-looking cells", () => {
    expect(toCsv([["=1+1", "+x", "-x", "@x", "ok"]])).toBe("'=1+1,'+x,'-x,'@x,ok");
  });
});
