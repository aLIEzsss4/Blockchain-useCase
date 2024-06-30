import { expect, test, describe } from "bun:test";
import {
  swapETHForExactTokens,
  swapExactTokensForETH,
  addLiquidityETH,
  removeLiquidityETH,
} from './index'

describe("PancakeSwap", () => {
  test("execute", async done => {
    await swapETHForExactTokens()
    await swapExactTokensForETH()
    await addLiquidityETH()
    await removeLiquidityETH()
    done()
  }, 60000);
})