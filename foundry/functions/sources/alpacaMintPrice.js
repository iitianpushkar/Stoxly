if (
    secrets.alpacaKey === "" ||
    secrets.alpacaSecret === ""
  ) {
    throw Error("Missing Alpaca API credentials")
  }
  
  const symbol = args[0]
  const qty = args[1] 
  
  const stockPriceRequest = Functions.makeHttpRequest({
    url: `https://data.alpaca.markets/v2/stocks/${symbol}/trades/latest`,
    headers: {
      accept: 'application/json',
      'APCA-API-KEY-ID': secrets.alpacaKey,
      'APCA-API-SECRET-KEY': secrets.alpacaSecret
    }
  })
  
  const [response] = await Promise.all([stockPriceRequest])
  
  if (!response || response.error) {
    throw Error("Failed to fetch stock price from Alpaca")
  }
  

  const stockPrice = response.data.trade.p
  
  console.log(`Alpaca Price for ${symbol}: $${stockPrice}`)

  // Place a market buy order
const placeOrderRequest = await Functions.makeHttpRequest({
  url: `https://paper-api.alpaca.markets/v2/orders`,
  method: "POST",
  headers: {
    accept: 'application/json',
    'APCA-API-KEY-ID': secrets.alpacaKey,
    'APCA-API-SECRET-KEY': secrets.alpacaSecret,
    'Content-Type': 'application/json'
  },
  data: {
    symbol: symbol,
    qty: qty,
    side: "buy",
    type: "market",
    time_in_force: "gtc"
  }
});

if (!placeOrderRequest || placeOrderRequest.error) {
  throw Error(`Failed to place order: ${placeOrderRequest?.error?.message || "Unknown error"}`);
}

console.log(`Order placed for ${symbol}:`, placeOrderRequest.data);


  
  // Convert float USD to uint256 with 18 decimals for Solidity
  return Functions.encodeUint256(Math.round(stockPrice * 1e18))
  