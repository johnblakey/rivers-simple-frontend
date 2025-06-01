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

$ npm install --save-dev vite

Create configs for Vite with tsconfig.json and package.json <https://github.com/vitejs/vite/tree/main/packages/create-vite/template-lit>

$ npx vite
Run the server, similar to Live Server (VS Code extension)

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
$ npm install chartjs-adapter-date-fns date-fns
$ npm install chart.js
$ npm install chartjs-plugin-annotation
$ npm install lit

$ npx eslint --init
Follow defaults

See scripts in package.json
$ npm run

Createed package.json scripts

### Run Scripts

$ npm run (name_command)

Created a launch.json file that enables Debugging Extension of TypeScript

### Create a new app to test in Chrome

$ npm run build
combines the individual TypeScript, linting, and server build into one for testing

then run VSCode "Run and Debug" test with Chrome, works by pointing at Vite dev server

Set env in Cloud Run to development so that endpoint is available to local frontend

### Local Testing Google Cloud Login (can remove after full new restart succeeds without Google login)

Was required if terminal or VS Code back when frontend directly connected to Datastore

- Login for Cloud Code repo with river-level-0 | use VS Code menu to authenticate then choose the project name
- $ gcloud auth login
- Adjust to river-level-0 project
- Login to Google Cloud CLI Application Default Credentials (ADC) to enable Datastore connection
- $ gcloud auth login --update-adc
- See instructions below for compiling and running the app

## Vite

<https://vite.dev/guide/>

Server runs after using the script "npm run dev" and opens a terminal console

See commands
h + Enter

Quit Server
q + Enter

## Lit

<https://lit.dev/articles/lit-cheat-sheet/>

## Dockerize and Deploy to Google Cloud Run

TODO - add steps from backend

## TODO

- Create tailwind css
- Add Terms of Use page, create a separate page

### Production

- TODO - Put Lit in production mode
- Verify if any other technology needs to be in production mode
- Verify that Cloud Run backend deployment is set to production env after frontend deployment
- Delete riverdetails gaugeName properties, (workaround need now removed)
