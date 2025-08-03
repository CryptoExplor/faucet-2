// A Node.js serverless function to handle faucet claims.
// This function performs rate-limiting with Upstash and sends a transaction.
// This should be deployed as an API endpoint, e.g., `/api/claim-eth`.
// It requires `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `FAUCET_PRIVATE_KEY`
// to be set as environment variables.

const { ethers } = require('https://cdn.ethers.io/lib/ethers-5.7.2.js');

module.exports = async (req, res) => {
  // Ensure the request method is POST for claims, or GET for a rate limit check
  const isRateLimitCheck = req.method === 'GET';

  // Get data from the request body or query parameters
  const { address, networkId, amount } = isRateLimitCheck ? req.query : req.body;

  if (!address || !networkId) {
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
  // The key for rate-limiting is a combination of network and address
  const rateLimitKey = `faucet:${networkId}:${address}`;
  const rateLimitUrl = UPSTASH_REDIS_REST_URL;
  const rateLimitHeaders = {
    Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
  };

  const getRateLimitData = async () => {
    // Get the timestamp of the last claim
    const lastClaimTimestamp = await fetch(`${rateLimitUrl}/get/${rateLimitKey}`, { headers: rateLimitHeaders }).then(r => r.json()).then(data => data.result);
    
    const now = Date.now();
    const nextClaimTime = lastClaimTimestamp ? parseInt(lastClaimTimestamp) + (RATE_LIMIT_HOURS * 60 * 60 * 1000) : now;
    const remainingTime = nextClaimTime - now;

    if (remainingTime > 0) {
      return { isRateLimited: true, canClaim: false, nextClaimTime, remainingTime };
    } else {
      return { isRateLimited: false, canClaim: true };
    }
  };

  // If this is a GET request, just return the rate limit status
  if (isRateLimitCheck) {
    const rateLimitStatus = await getRateLimitData();
    return res.status(200).json(rateLimitStatus);
  }

  // --- Handle POST Request (Claim) ---
  const { isRateLimited } = await getRateLimitData();
  if (isRateLimited) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  const SUPPORTED_NETWORKS = [
      { id: "base-sepolia", rpcUrl: "https://sepolia.base.org" },
      { id: "optimism-sepolia", rpcUrl: "https://sepolia.optimism.io" },
      { id: "arbitrum-sepolia", rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc" },
      { id: "scroll-sepolia", rpcUrl: "https://sepolia-rpc.scroll.io" },
      { id: "mode-sepolia", rpcUrl: "https://sepolia.mode.network" },
      { id: "zora-sepolia", rpcUrl: "https://sepolia.rpc.zora.energy" },
      { id: "unichain-sepolia", rpcUrl: "https://sepolia.unichain.org" },
      { id: "blast-sepolia", rpcUrl: "https://sepolia.blast.io" },
      { id: "frax-sepolia", rpcUrl: "https://rpc.testnet.frax.com" },
      { id: "cyber-sepolia", rpcUrl: "https://cyber-testnet.alt.technology" },
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

    // On success, set the rate limit key with the current timestamp
    await fetch(`${rateLimitUrl}/set/${rateLimitKey}?EX=${RATE_LIMIT_HOURS * 60 * 60}`, {
        headers: rateLimitHeaders,
        body: JSON.stringify(Date.now()),
    });

    res.status(200).json({ message: 'Transaction successful!', txHash: transactionResponse.hash });

  } catch (error) {
    console.error('Blockchain transaction error:', error);
    res.status(500).json({ error: 'Failed to send transaction.' });
  }
};
