require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const SpotifyWebApi = require('spotify-web-api-node');
const axios = require('axios');
const express = require('express');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/callback'
});

const app = express();
const port = process.env.PORT || 3000;

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);
    res.send('Authenticated with Spotify.');
  } catch (error) {
    console.error('Error in Spotify authentication:', error);
    res.send('Error in Spotify authentication.');
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Welcome to the Spotify Playlist Creator Bot.");
});

bot.onText(/\/authenticate/, (msg) => {
  const authUrl = spotifyApi.createAuthorizeURL(['playlist-modify-private', 'playlist-modify-public']);
  bot.sendMessage(msg.chat.id, `Authenticate with Spotify: ${authUrl}`);
});

bot.onText(/\/create/, async (msg) => {
  const reply = await get_openai_response("What do you want in your playlist?");
  bot.sendMessage(msg.chat.id, reply);
});

bot.onText(/\/next_step/, async (msg) => {
  const playlistDetails = { name: 'New Playlist', tracks: [] };
  const playlistId = await create_playlist(playlistDetails);
  if (playlistId) {
    bot.sendMessage(msg.chat.id, `Playlist created: https://open.spotify.com/playlist/${playlistId}`);
  } else {
    bot.sendMessage(msg.chat.id, "Error creating your playlist.");
  }
});

bot.onText(/\/save_playlist/, (msg) => {
  bot.sendMessage(msg.chat.id, "Playlist saved.");
});

async function get_openai_response(message) {
  try {
    const response = await axios.post('https://api.openai.com/v1/engines/davinci/completions', {
      prompt: message,
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });
    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    return 'Error in processing your request.';
  }
}

async function create_playlist(playlistDetails) {
  try {
    const data = await spotifyApi.createPlaylist(playlistDetails.name, { 'description': 'Created with Telegram Bot', 'public': true });
    const playlistId = data.body.id;
    return playlistId;
  } catch (error) {
    console.error('Error creating Spotify playlist:', error);
    return null;
  }
}
