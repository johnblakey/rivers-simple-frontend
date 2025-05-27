# rivers-simple-frontend

Simple HTML, CSS, TypeScript for rivers website <https://rivers.johnblakey.org/>

## Setup TypeScript Project

Summary: plan to use the MDN recommended toolchain and coding style for beginners

Following <https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Client-side_tools/Introducing_complete_toolchain#introducing_our_case_study>

- Add .gitignore with Node style ignore entries

$ npm install typescript --save-dev

$ npx tsc --init

$ npm init
or (for less npm package setup questions)
$ npm init -y
Followed questions to create package.json

Added
"type": "module",
"private": true,

Final package.json

{
"name": "simple-website-tooling-test",
"type": "module",
"private": true,
"version": "0.1.0",
"description": "JavaScript, HTML, CSS and other tools in VS Code test.",
"main": "main.js",
"scripts": {
"test": "echo \"Error: no test specified\" && exit 1",
"dev": "npx vite"
},
"author": "JB",
"license": "ISC"
}

$ npm install --save-dev vite

$ npx vite
Run the server, similar to Live Server (VS Code extension))

$ npx vite build

$ npm run dev
Created "dev" script in package.json to reference "npx vite"

Following <https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Client-side_tools/Package_management>

$ npm install --save-dev prettier

Add
.prettierrc.json
{
"bracketSameLine": true
}

Installed Prettier VSCode extension
TODO - enable override of setup above in npm

$ npm install --save-dev eslint @eslint/js globals

$ npx eslint --init
Follow defaults

See scripts in package.json
$ npm run

Create package.json scripts

Make them $ npm run (name_command)

Create a launch.json file with Debug Extension\
