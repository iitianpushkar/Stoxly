import {
  IAgentRuntime,
  Provider,
  ProviderResult,
  Memory,
  State,
  elizaLogger,
  parseKeyValueXml,
  ModelType,
} from '@elizaos/core';

const tokenBalanceTemplate = `Extract the stock name, provide its official stock symbol from the user's message.

User message: "{{userMessage}}"

Return in this format:
<response>
<stockSym>STOCK_SYMBOL</stockSym>
</response>

If no stock is mentioned or it's not a stock inquiry, return:
<response>
<error>Not a stock related request</error>
</response>`;

export const StockUsdExc: Provider = {
  name: 'STOCKUSDExchangeRateProvider',
  description: 'A provider for getting stock prices in USD using Twelve Data API',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state: State
  ): Promise<ProviderResult> => {
    try {
      const prompt = tokenBalanceTemplate.replace(
        '{{userMessage}}',
        _message.content.text || ''
      );

      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
      });

      console.log('Model response:', response);

      const parsed = parseKeyValueXml(response);

      if (!parsed || parsed.error || !parsed.stockSym) {
        return { text: '', data: {}, values: {} };
      }

      const stockSym = parsed.stockSym.toUpperCase();
      console.log("stock symbol", stockSym);

      const twelveDataApiKey = '089648fd0b744f69a39eb0052834ff3b';
      const stockPriceRequest = await fetch(
        `https://api.twelvedata.com/price?symbol=${stockSym}&apikey=${twelveDataApiKey}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
          },
        }
      );

      const json = await stockPriceRequest.json() as { price?: string, code?: string, message?: string };

      if (!json.price) {
        const errorMsg = json.message || 'Price not available';
        return {
          text: `Could not retrieve price for stock symbol "${stockSym}": ${errorMsg}`,
          data: {},
          values: {},
        };
      }

      const stockPrice = parseFloat(json.price);

      return {
        text: `The current USD price for stock ${stockSym} is $${stockPrice}.`,
        values: {
          symbol: stockSym,
          priceUsd: stockPrice,
        },
        data: {
          twelveData: json,
        },
      };
    } catch (err: any) {
      elizaLogger.error('StockUsdExc error:', err.message);
      console.log('StockUsdExc error:', err);
      return { text: 'Something went wrong fetching the stock price.', data: {}, values: {} };
    }
  },
};
