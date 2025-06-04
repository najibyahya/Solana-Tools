const MainMenu = require('./src/menu/mainMenu');

async function main() {
  const asciiArt = `\x1b[35m
  ___       _                  ___           _     
 / __> ___ | | ___ ._ _  ___  |_ _|___  ___ | | ___
 \\__ \\/ . \\| |<_> || ' |<_> |  | |/ . \\/ . \\| |<_-<
 <___/\\___/|_|<___||_|_|<___|  |_|\____/\\___/|_|/__/\x1b[0m
  [ \x1b[33mv1.4\x1b[0m ]                      [ \x1b[34mt.me/boterdrop\x1b[0m ]
  `;

  console.log(asciiArt);
  
  const menu = new MainMenu();
  await menu.start();
}

main().catch(console.error);
