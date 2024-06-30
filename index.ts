import {
    createPublicClient,
    createWalletClient,
    http,
    parseAbi,
} from "viem";
import { zkSync } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";


dotenv.config();

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const walletClient = createWalletClient({
    account,
    chain: zkSync,
    transport: http(),
});

const client = createPublicClient({
    chain: zkSync,
    transport: http(),
});

const pancake_router_address_zksync = "0x5aEaF2883FBf30f3D62471154eDa3C0c1b05942d"
const usdt_address_zksync = "0x493257fd37edb34451f62edf8d2a0c418852ba4c"
const weth_address_zksync = "0x5aea5775959fbc2557cc8789bc1bf90a239d9a91"

const abi = parseAbi([
    'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)',
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
    'function factory() external view returns (address)',
    'function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB)',
    'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
    'function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) external returns (uint256 amountToken, uint256 amountETH)'
])

const factory_abi = parseAbi([
    'function getPair(address tokenA, address tokenB) external view returns (address)'
])

const pair_abi = parseAbi([
    'function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)',
    'function token0() external view returns (address)',
    'function balanceOf(address owner) external view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
])


const usdt_abi = parseAbi([
    'function approve(address spender, uint256 value) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address owner) external view returns (uint256)',
])
function getTime() {
    return Math.floor(Date.now() / 1000)
}

export async function swapETHForExactTokens() {
    const amountsIn = await client.readContract({
        address: pancake_router_address_zksync,
        abi,
        functionName: "getAmountsIn",
        args: [BigInt(1000000), [weth_address_zksync, usdt_address_zksync]],
    });

    const hash = await walletClient.writeContract({
        address: pancake_router_address_zksync,
        abi,
        functionName: "swapETHForExactTokens",
        args: [BigInt(1000000), [weth_address_zksync, usdt_address_zksync], account.address, BigInt(getTime() + 5 * 60)],
        value: amountsIn[0]
    });

    console.log("ETH swap to USDT hash is:", hash);
    return hash
}

export async function swapExactTokensForETH() {
    
    let allowance = await client.readContract({
        address: usdt_address_zksync,
        abi: usdt_abi,
        functionName: "allowance",
        args: [account.address, pancake_router_address_zksync],
    });
    
    if (allowance < BigInt(1e6)) {
        const hash = await walletClient.writeContract({
            address: usdt_address_zksync,
            abi: usdt_abi,
            functionName: "approve",
            args: [pancake_router_address_zksync, BigInt(1e10)],
        });

        await client.waitForTransactionReceipt({ hash });

    }

    const amountsOut = await client.readContract({
        address: pancake_router_address_zksync,
        abi,
        functionName: "getAmountsOut",
        args: [BigInt(1000000), [usdt_address_zksync, weth_address_zksync]],
    });
    // set Slippage Tolerance 0.5%
    const amountOutMin = amountsOut[1] * BigInt(995) / BigInt(1000)

    const hash = await walletClient.writeContract({
        address: pancake_router_address_zksync,
        abi,
        functionName: "swapExactTokensForETH",
        args: [BigInt(1000000), amountOutMin, [usdt_address_zksync, weth_address_zksync], account.address, BigInt(getTime() + 5 * 60)],
    });

    console.log("USDT swap to ETH hash is:", hash);
    return hash
}

export async function addLiquidityETH() {

    let allowance = await client.readContract({
        address: usdt_address_zksync,
        abi: usdt_abi,
        functionName: "allowance",
        args: [account.address, pancake_router_address_zksync],
    });
    
    if (allowance < BigInt(1e6)) {
        const hash = await walletClient.writeContract({
            address: usdt_address_zksync,
            abi: usdt_abi,
            functionName: "approve",
            args: [pancake_router_address_zksync, BigInt(1e10)],
        });

        await client.waitForTransactionReceipt({ hash });

    }
    const balance = await client.readContract({

        address: usdt_address_zksync,
        abi: usdt_abi,
        functionName: "balanceOf",
        args: [account.address],
    })

    if (balance < 1e6) {
        await swapETHForExactTokens()
    }

    const factory_address = await client.readContract({
        address: pancake_router_address_zksync,
        abi,
        functionName: "factory",
    });

    const pair_address = await client.readContract({
        address: factory_address,
        abi: factory_abi,
        functionName: "getPair",
        args: [usdt_address_zksync, weth_address_zksync],
    });

    const token0_address = await client.readContract({
        address: pair_address,
        abi: pair_abi,
        functionName: "token0",
    });

    const reserves = await client.readContract({
        address: pair_address,
        abi: pair_abi,
        functionName: "getReserves",
    });

    let reserveA = reserves[0], reserveB = reserves[1]
    if (token0_address.toLowerCase() != usdt_address_zksync.toLowerCase()) {
        reserveA = reserves[1]
        reserveB = reserves[0]
    }

    const amountB = await client.readContract({
        address: pancake_router_address_zksync,
        abi,
        functionName: "quote",
        args: [BigInt(1e6), reserveA, reserveB],
    });


    const amountTokenDesired = BigInt(1e6)
    const amountTokenMin = BigInt(1e6) * BigInt(995) / BigInt(1000)
    const amountETHMin = amountB * BigInt(995) / BigInt(1000)
    
    const hash = await walletClient.writeContract({
        address: pancake_router_address_zksync,
        abi,
        functionName: "addLiquidityETH", // function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline)
        args: [usdt_address_zksync, amountTokenDesired, amountTokenMin, amountETHMin, account.address, BigInt(getTime() + 5 * 60)],
        value: amountB
    });

    console.log("Add ETH/USDT LP hash is:", hash);
    return hash
}

export async function removeLiquidityETH() {

    const factory_address = await client.readContract({
        address: pancake_router_address_zksync,
        abi,
        functionName: "factory",
    });

    const pair_address = await client.readContract({
        address: factory_address,
        abi: factory_abi,
        functionName: "getPair",
        args: [usdt_address_zksync, weth_address_zksync],
    });

    let allowance = await client.readContract({
        address: pair_address,
        abi: usdt_abi,
        functionName: "allowance",
        args: [account.address, pancake_router_address_zksync],
    });
    
    if (allowance < BigInt(1e18)) {
        const hash = await walletClient.writeContract({
            address: pair_address,
            abi: usdt_abi,
            functionName: "approve",
            args: [pancake_router_address_zksync, BigInt(1e25)],
        });

        await client.waitForTransactionReceipt({ hash });

    }
    const totalSupply = await client.readContract({
        address: pair_address,
        abi: pair_abi,
        functionName: "totalSupply",
    });

    const myLP = await client.readContract({
        address: pair_address,
        abi: pair_abi,
        functionName: "balanceOf",
        args: [account.address],
    });
    if (myLP < 10) {
        await addLiquidityETH()
    }
    
    const usdt_balance = await client.readContract({
        address: usdt_address_zksync,
        abi: pair_abi,
        functionName: "balanceOf",
        args: [pair_address],
    });
    
    const weth_balance = await client.readContract({
        address: weth_address_zksync,
        abi: pair_abi,
        functionName: "balanceOf",
        args: [pair_address],
    });

    const token0_address = await client.readContract({
        address: pair_address,
        abi: pair_abi,
        functionName: "token0",
    });

    let balance0 = usdt_balance, balance1 = weth_balance
    if (token0_address.toLowerCase() != usdt_address_zksync.toLowerCase()) {
        balance0 = weth_balance
        balance1 = usdt_balance
    }

    const amountTokenMin = (myLP * balance0 / totalSupply) * BigInt(995) / BigInt(1000)
    const amountETHMin = (myLP * balance1 / totalSupply) * BigInt(995) / BigInt(1000)
    
    const hash = await walletClient.writeContract({
        address: pancake_router_address_zksync,
        abi,
        functionName: "removeLiquidityETH", // address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline
        args: [usdt_address_zksync, myLP, amountTokenMin, amountETHMin, account.address, BigInt(getTime() + 5 * 60)],
    });

    console.log("Remove ETH/USDT LP hash is:", hash);
    return hash
}

async function main() {
    await swapETHForExactTokens()
    await swapExactTokensForETH()
    await addLiquidityETH()
    await removeLiquidityETH()
}

// main();