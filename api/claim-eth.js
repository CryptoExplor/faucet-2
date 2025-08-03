// A Node.js serverless function to handle faucet claims.
// This function performs rate-limiting with Upstash and sends a transaction.
// This should be deployed as an API endpoint, e.g., `/api/claim-eth`.
// It requires `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `FAUCET_PRIVATE_KEY`
// to be set as environment variables.

const { ethers } = require('https://cdn.ethers.io/lib/ethers-5.7.2.js');

module.exports = async (req, res) => {
  // Ensure the request method is POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Get data from the request body
  const { address, networkId, amount } = req.body;

  if (!address || !networkId || !amount) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  // --- Environment Variables ---
  const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY;
  const RATE_LIMIT_HOURS = 24;

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN || !FAUCET_PRIVATE_KEY) {
    console.error('Missing required environment variables for the faucet API.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // --- Upstash Rate-Limiting Logic ---
  const redisKey = `faucet:claim:${address}:${networkId}`;
  
  try {
    const redisResponse = await fetch(`${UPSTASH_REDIS_REST_URL}/set/${redisKey}?EX=${RATE_LIMIT_HOURS * 3600}&NX`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
      method: 'POST',
      body: '1', // Store a simple value
    });

    const redisData = await redisResponse.text();
    if (redisData !== '"OK"') {
      // The key already exists, so the user is rate-limited
      return res.status(429).json({ error: `Rate limit exceeded. Please wait ${RATE_LIMIT_HOURS} hours.` });
    }
  } catch (error) {
    console.error('Upstash rate-limiting failed:', error);
    return res.status(500).json({ error: 'Rate-limiting service failed.' });
  }

  // --- Network Configuration (must match client-side) ---
  const SUPPORTED_NETWORKS = [
      { id: "base-sepolia", chainId: 84532, rpcUrl: "https://sepolia.base.org" },
      { id: "optimism-sepolia", chainId: 11155420, rpcUrl: "https://sepolia.optimism.io" },
      { id: "arbitrum-sepolia", chainId: 421614, rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc" },
      { id: "ink-sepolia", chainId: 763373, rpcUrl: "https://rpc-gel-sepolia.inkonchain.com" },
      { id: "mode-sepolia", chainId: 919, rpcUrl: "https://sepolia.mode.network" },
      { id: "zora-sepolia", chainId: 999999999, rpcUrl: "https://sepolia.rpc.zora.energy" },
      { id: "unichain-sepolia", chainId: 1301, rpcUrl: "https://sepolia.unichain.org" },
      { id: "blast-sepolia", chainId: 168587773, rpcUrl: "https://sepolia.blast.io" },
      { id: "frax-sepolia", chainId: 2522, rpcUrl: "https://rpc.testnet.frax.com" },
      { id: "cyber-sepolia", chainId: 111557560, rpcUrl: "https://cyber-testnet.alt.technology" },
  ];
  
  const network = SUPPORTED_NETWORKS.find(n => n.id === networkId);

  if (!network) {
    return res.status(400).json({ error: 'Unsupported network ID.' });
  }

  // --- Blockchain Transaction Logic ---
  try {
    const provider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
    const wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, provider);

    const tx = {
      to: address,
      value: ethers.utils.parseEther(amount),
    };

    const transactionResponse = await wallet.sendTransaction(tx);
    await transactionResponse.wait(); // Wait for the transaction to be mined

    res.status(200).json({ txHash: transactionResponse.hash });
  } catch (error) {
    console.error('Failed to send transaction:', error);
    // If the transaction fails, we should remove the rate-limit key
    await fetch(`${UPSTASH_REDIS_REST_URL}/del/${redisKey}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });
    res.status(500).json({ error: 'Failed to send transaction.' });
  }
};
