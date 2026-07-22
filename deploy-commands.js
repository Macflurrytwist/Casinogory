// deploy-commands.js — run once (and again any time command definitions
// change): `npm run deploy-commands`
require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Pull the lever and play today's CASINOGORY round"),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("See today's or all-time CASINOGORY leaderboard")
    .addStringOption(opt =>
      opt.setName("scope").setDescription("Today or all-time").addChoices(
        { name: "Today", value: "today" },
        { name: "All-Time", value: "alltime" }
      ))
    .addStringOption(opt =>
      opt.setName("metric").setDescription("Ranked by").addChoices(
        { name: "Daily Rarity", value: "daily" },
        { name: "Historic Rarity", value: "historic" },
        { name: "Overall", value: "overall" }
      )),
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link this Discord account to your existing CASINOGORY web account")
    .addStringOption(opt =>
      opt.setName("code").setDescription("The code shown on the website's Stats page").setRequired(true)),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Your CASINOGORY streak, perks, and history")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const route = process.env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
      : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log(
      process.env.DISCORD_GUILD_ID
        ? "Commands registered to guild — should appear instantly."
        : "Commands registered globally — can take up to ~1 hour to appear everywhere."
    );
  } catch (err) {
    console.error("Failed to register commands:", err);
    process.exit(1);
  }
})();
