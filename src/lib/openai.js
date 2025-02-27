import { Configuration, OpenAIApi } from "openai";

// Ensure you replace 'YOUR_OPENAI_API_KEY' with your actual OpenAI API key
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY, // It's best practice to use environment variables for API keys
});

const openai = new OpenAIApi(configuration);

export default openai;
