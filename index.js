// index.js — CASINOGORY Discord bot
//
// Talks to the same REST API the website uses (see ../backend/routes).
// Flow per player: /play -> pick a reel (button) -> pick 10 categories
// (select menu, min=max=10 so Discord enforces the count natively) ->
// answer in two modals of 5 fields each (Discord's modal limit) -> auto-
// submits when the server-computed timer runs out, same as the website.

require("dotenv").config();
const {
  Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");

const API_BASE = process.env.GAME_API_BASE;
const WEB_BASE = API_BASE.replace(/\/api\/?$/, ""); // for building "beat my score" links to the website
const BOT_SECRET = process.env.DISCORD_BOT_SHARED_SECRET;

if (!process.env.DISCORD_TOKEN || !API_BASE || !BOT_SECRET) {
  console.error("Missing required env vars — copy .env.example to .env and fill it in.");
  process.exit(1);
}

/* ---------------- API helpers ---------------- */
async function api(path, { method = "GET", token = null, body = null } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function ensureAccountReal(discordUser) {
  const res = await fetch(API_BASE + "/auth/discord", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bot-Secret": BOT_SECRET },
    body: JSON.stringify({ discordId: discordUser.id, username: discordUser.username })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't create/find your account");
  return data; // { token, user, streak }
}

/* ---------------- session state (in-memory, per Discord user) ----------------
   Lost on bot restart — acceptable for an in-progress round; nothing is
   scored until /submit, so a restart mid-round just means replaying it. */
const sessions = new Map(); // discordUserId -> session

function newSession(token, userId, name) {
  return { token, userId, name, wordLength: null, word: null, wordRarity: null,
    allCategories: [], chosenCategories: [], answers: {}, deadlineAt: null, timeoutHandle: null };
}

/* ---------------- UI builders ---------------- */
function reelButtons(status) {
  const row = new ActionRowBuilder();
  [4, 5, 6, 7].forEach(len => {
    const available = status.availableLengths.includes(len);
    const done = status.submittedLengths.includes(len);
    let label = `${len}-Letter`;
    if (len === 7) label = available ? "7-Letter ✨" : "7-Letter 🔒";
    if (done) label += " ✓";
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("reel_" + len)
        .setLabel(label)
        .setStyle(done ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(!available || done)
    );
  });
  return row;
}

function categorySelectRow(categories) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("category_select")
    .setPlaceholder("Choose exactly 10 categories…")
    .setMinValues(10)
    .setMaxValues(10)
    .addOptions(categories.slice(0, 25).map(c => ({
      label: c.name.slice(0, 100),
      value: c.id,
      description: c.onlyLengths ? `Length-specific (${c.onlyLengths.join("/")})` : "Universal"
    })));
  return new ActionRowBuilder().addComponents(menu);
}

function answerModal(customId, title, categories) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  categories.forEach(cat => {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("ans_" + cat.id)
          .setLabel(cat.name.slice(0, 45))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(100)
      )
    );
  });
  return modal;
}

function tierEmoji(tier) {
  return { Skipped: "⬜", Common: "🔘", Uncommon: "🟢", Rare: "🔵", Legendary: "🟣" }[tier] || "⬜";
}

/* ---------------- submit + auto-submit-on-timeout ---------------- */
async function finalizeSubmission(session, interactionOrChannel, isAuto) {
  if (session.timeoutHandle) clearTimeout(session.timeoutHandle);
  sessions.delete(session.userId);

  const answersByName = {};
  session.chosenCategories.forEach(cat => {
    answersByName[cat.name] = session.answers[cat.id] || "";
  });

  let result;
  try {
    result = await api("/submit", { method: "POST", token: session.token, body: { wordLength: session.wordLength, answers: answersByName } });
  } catch (err) {
    const msg = `Couldn't submit your ledger: ${err.message}`;
    if (interactionOrChannel.followUp) await interactionOrChannel.followUp({ content: msg, ephemeral: true });
    else await interactionOrChannel.send(msg);
    return;
  }

  const lines = result.rows.map(r =>
    `${tierEmoji(r.tier)} **${r.category}** — *${r.answer || "(skipped)"}* — ${r.tier} · +${r.total}`
  ).join("\n");

  const privateEmbed = new EmbedBuilder()
    .setTitle(`Today's Ledger — ${result.word} (${session.wordLength}-letter)`)
    .setDescription(lines)
    .addFields(
      { name: "Category Points", value: String(result.categoryPoints), inline: true },
      { name: "Word Bonus", value: String(result.wordBonus) + (result.doubleBonus ? " (doubled!)" : ""), inline: true },
      { name: "Total", value: `**${result.finalTotal}**`, inline: true }
    )
    .setColor(0xd9b64a);

  if (isAuto) {
    try { await interactionOrChannel.send({ content: `<@${session.userId}> ⏰ Time's up — your ledger auto-sealed.`, embeds: [privateEmbed] }); }
    catch { /* channel may be gone, ignore */ }
  } else {
    await interactionOrChannel.editReply({ embeds: [privateEmbed], components: [] });
  }

  // Public, shareable flex message — this is the growth loop.
  const channel = interactionOrChannel.channel || interactionOrChannel;
  if (channel && channel.send) {
    const squares = result.rows.map(r => tierEmoji(r.tier)).join("");
    const challengeLink = `${WEB_BASE}/?beat=1&by=${encodeURIComponent(session.name)}&score=${result.finalTotal}&len=${session.wordLength}&date=${result.date}`;
    channel.send(
      `🎰 **${session.name}** just scored **${result.finalTotal}** on today's **${session.wordLength}-letter** word (${result.word}).\n` +
      `${squares}\n` +
      `Beat my score → \`/play\` here, or ${challengeLink}`
    );
  }
}

/* ---------------- bot ---------------- */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, () => console.log(`Logged in as ${client.user.tag}`));

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "play") return handlePlay(interaction);
      if (interaction.commandName === "leaderboard") return handleLeaderboard(interaction);
      if (interaction.commandName === "stats") return handleStats(interaction);
      if (interaction.commandName === "link") return handleLink(interaction);
    }
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("reel_")) return handleReelPick(interaction);
      if (interaction.customId === "answers_1") return handleOpenModal(interaction, 1);
      if (interaction.customId === "answers_2") return handleOpenModal(interaction, 2);
    }
    if (interaction.isStringSelectMenu() && interaction.customId === "category_select") {
      return handleCategorySelect(interaction);
    }
    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_round1") return handleModalSubmit(interaction, 1);
      if (interaction.customId === "modal_round2") return handleModalSubmit(interaction, 2);
    }
  } catch (err) {
    console.error(err);
    const msg = "Something went wrong: " + err.message;
    if (interaction.deferred || interaction.replied) interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
    else interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
});

async function handlePlay(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const auth = await ensureAccountReal(interaction.user);
  const status = await api("/daily/status", { token: auth.token });
  sessions.set(interaction.user.id, newSession(auth.token, interaction.user.id, interaction.user.username));

  const embed = new EmbedBuilder()
    .setTitle("🎰 CASINOGORY — Pull a Reel")
    .setDescription(`Streak: **${status.streak.current_streak} days**. Pick a length to reveal today's word. One submission per length, per day.`)
    .setColor(0x7a2230);
  await interaction.editReply({ embeds: [embed], components: [reelButtons(status)] });
}

async function handleReelPick(interaction) {
  const len = parseInt(interaction.customId.split("_")[1], 10);
  const session = sessions.get(interaction.user.id);
  if (!session) { await interaction.reply({ content: "Run `/play` first.", ephemeral: true }); return; }

  await interaction.deferUpdate();
  const spin = await api("/daily/spin", { method: "POST", token: session.token, body: { wordLength: len } });
  session.wordLength = len; session.word = spin.word; session.wordRarity = spin.wordRarityDaily;
  session.allCategories = spin.categories;

  const embed = new EmbedBuilder()
    .setTitle(`Today's Word: ${spin.word}`)
    .setDescription(
      `Daily Rarity **${spin.wordRarityDaily}/100**. The word is revealed *before* you choose categories — that's the gamble.\n\n` +
      `Your answer doesn't need to match the word, just **connect** to it — a name, reference, object, or association all count.\n\n` +
      `Pick exactly 10 categories below.`
    )
    .setColor(0xd9b64a);
  await interaction.editReply({ embeds: [embed], components: [categorySelectRow(spin.categories)] });
}

async function handleCategorySelect(interaction) {
  const session = sessions.get(interaction.user.id);
  if (!session) { await interaction.reply({ content: "Run `/play` first.", ephemeral: true }); return; }

  await interaction.deferUpdate();
  const chosenIds = interaction.values;
  session.chosenCategories = session.allCategories.filter(c => chosenIds.includes(c.id));

  const timer = await api("/daily/confirm-categories", {
    method: "POST", token: session.token,
    body: { wordLength: session.wordLength, categories: session.chosenCategories }
  });
  const deadlineMs = Date.now() + timer.timeLimitSeconds * 1000;
  session.deadlineAt = deadlineMs;
  const deadlineUnix = Math.floor(deadlineMs / 1000);

  session.timeoutHandle = setTimeout(() => {
    const s = sessions.get(interaction.user.id);
    if (s) finalizeSubmission(s, interaction.channel, true);
  }, timer.timeLimitSeconds * 1000);

  const list = session.chosenCategories.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
  const embed = new EmbedBuilder()
    .setTitle(`Fill the Ledger — ${session.word}`)
    .setDescription(`Answers close <t:${deadlineUnix}:R>. Unanswered categories score zero at the buzzer.\n\n${list}`)
    .setColor(0x39e6e0);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("answers_1").setLabel("Answer Categories 1–5").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("answers_2").setLabel("Answer Categories 6–10").setStyle(ButtonStyle.Primary)
  );
  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleOpenModal(interaction, round) {
  const session = sessions.get(interaction.user.id);
  if (!session) { await interaction.reply({ content: "Run `/play` first.", ephemeral: true }); return; }
  const slice = round === 1 ? session.chosenCategories.slice(0, 5) : session.chosenCategories.slice(5, 10);
  const modal = answerModal(round === 1 ? "modal_round1" : "modal_round2", `Categories ${round === 1 ? "1–5" : "6–10"}`, slice);
  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction, round) {
  const session = sessions.get(interaction.user.id);
  if (!session) { await interaction.reply({ content: "That round expired. Run `/play` again.", ephemeral: true }); return; }

  const slice = round === 1 ? session.chosenCategories.slice(0, 5) : session.chosenCategories.slice(5, 10);
  slice.forEach(cat => {
    session.answers[cat.id] = interaction.fields.getTextInputValue("ans_" + cat.id) || "";
  });

  const answeredCount = session.chosenCategories.filter(c => session.answers[c.id]).length;
  const bothRoundsDone = session.chosenCategories.every(c => c.id in session.answers);

  if (bothRoundsDone) {
    await interaction.deferReply({ ephemeral: true });
    await finalizeSubmission(session, interaction, false);
  } else {
    const nextBtn = round === 1 ? "answers_2" : "answers_1";
    const nextLabel = round === 1 ? "Answer Categories 6–10" : "Answer Categories 1–5";
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(nextBtn).setLabel(nextLabel).setStyle(ButtonStyle.Primary)
    );
    await interaction.reply({ content: `Saved ${answeredCount}/10 so far — keep going.`, components: [row], ephemeral: true });
  }
}

async function handleLeaderboard(interaction) {
  await interaction.deferReply();
  const scope = interaction.options.getString("scope") || "today";
  const metric = interaction.options.getString("metric") || "daily";
  const data = await api(`/leaderboard?scope=${scope}&metric=${metric}&wordLength=all&limit=10`);
  const rows = data.rows.length
    ? data.rows.map(r => `**#${r.rank}** ${r.name} — ${r.points} pts${r.word ? ` (${r.word}, ${r.wordLength}-letter)` : ""}`).join("\n")
    : "No scores yet.";
  const embed = new EmbedBuilder()
    .setTitle(`🏆 CASINOGORY Leaderboard — ${scope === "today" ? "Today" : "All-Time"} · ${metric[0].toUpperCase() + metric.slice(1)} Rarity`)
    .setDescription(rows)
    .setColor(0xd9b64a);
  await interaction.editReply({ embeds: [embed] });
}

async function handleStats(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const auth = await ensureAccountReal(interaction.user);
  const stats = await api("/stats", { token: auth.token });
  const perks = stats.streak.unlocked_perks.length ? stats.streak.unlocked_perks.join(", ") : "None yet";
  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username}'s CASINOGORY Stats`)
    .addFields(
      { name: "Current Streak", value: `${stats.streak.current_streak} days`, inline: true },
      { name: "Longest Streak", value: `${stats.streak.longest_streak} days`, inline: true },
      { name: "Unlocked Perks", value: perks }
    )
    .setColor(0x7a2230);
  await interaction.editReply({ embeds: [embed] });
}

async function handleLink(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const code = interaction.options.getString("code").trim().toUpperCase();
  try {
    const res = await fetch(API_BASE + "/auth/link/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bot-Secret": BOT_SECRET },
      body: JSON.stringify({ code, discordId: interaction.user.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't link that code");
    sessions.delete(interaction.user.id); // any in-progress guest-account round is now stale
    await interaction.editReply(`✅ Linked! This Discord account now plays as **${data.user.name}** — your streak, perks, and history carry over from the website.`);
  } catch (err) {
    await interaction.editReply(`❌ ${err.message}`);
  }
}

client.login(process.env.DISCORD_TOKEN);
