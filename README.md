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

For production, use Vite production build vs development build. Note warning in console goes away.

## Dockerize Frontend and Deploy to Google Cloud Run

### Build process

Docker image should be lean and delete items not needed after setup (TODO - verify this)
I use "server" to make assets avaialble to website in production build

### Steps

Created artifact repo <https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-backend?hl=en&inv=1&invt=AbyuDg&project=river-level-0> in Google Cloud. Default settings, single region, turned off scanning to save money.

Start the Docker Desktop Apple app and login (see phone)

Dockerize locally tested variant
$ docker build --platform linux/amd64 -t rivers-lit .
Note - the command here ^ and below use the default behavior that the latest tag is assumed without a tag in the commands. Error note - tried pushing the default Docker build and it wasn't accepted by Google b/c only Linux architecture is accepted, the linux tag above solved it.

Optional - see images in Docker VS Code extension (or $ docker images). Notice the rivers-lit has a "latest" image now (if you saw the previous images that existed on the local machine).

Test docker locally, (be sure the backend Cloud Run is set to "development" or it will not connect)
$ docker run -p 8080:8080 -e PORT=8080 rivers-lit
If the docker image passes testing, move onto the next steps to deploy it.

Note last Docker Image tag currently in the Google Cloud Artifacts <https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-frontend/rivers-lit?hl=en&inv=1&invt=AbzKVw&project=river-level-0>

Tag the next (e.g. v1 -> v2) create docker image version to use in Cloud Run
$ docker tag rivers-lit us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v4

Push the created Docker image tag to the Artifact Registry
$ docker push us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v4

If push fails try to sign into Google Artifact Registry in VSCode terminal. It updates the Docker configuration file. Then try pushing to docker above again.
$ gcloud auth configure-docker us-west1-docker.pkg.dev

Verify the version tag push was successful to the Artifact Registry -> <https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-frontend/rivers-lit?hl=en&inv=1&invt=AbzKVw&project=river-level-0>

Deploy the latest version tag to Cloud Run: go to Cloud Run Console page > <https://console.cloud.google.com/run?hl=en&inv=1&invt=AbyufQ&project=river-level-0> > rivers-backend > settings > Edit & deploy new revision > Containers > Edit Containers > choose Image URL > check version (e.g. v2) image > Select > selected 128 Mib of memory | chose unauthenticated invocation | PORT 8080 choice acts as setting $PORT in the command line

Verify the URL on the <https://console.cloud.google.com/run/detail/us-west1/rivers-flask/revisions?project=river-level-0&hl=en&inv=1&invt=AbyvEw> page shows the latest functional app

Verify <https://api.rivers.johnblakey.org/> is showing the latest functional app (depending on CORS setting) (verify bugs were not introduced | manual regression testing/QA [TODO - add test suite]) | Use cURL if CORS doesn't allow a direct browser call
$ curl -X GET <https://api.rivers.johnblakey.org/riverdetails>
or test deployment with browser
<https://api.rivers.johnblakey.org/riverlevels/sitecode/14231900>
or test locally with browser
<http://127.0.0.1:5000/riverlevels/sitecode/14231900>

If not passing, verify the same bug in local testing. Fix and start process again.

If passing the test, create pull request into main merge the test branch into main. Then create a tag.

Note the last tag using the convention vx.y.z (e.g., v0.1.4) <https://github.com/johnblakey/rivers-simple-backend/tags> and create the next iteration of the tag of the new tested Docker Image with VS Code > Source Control > ... > Tags > Create Tag > v0.1.4 > "Describe new features or bugfixes"

Push created local tag to GitHub
$  git push origin <tag_name>
Note that the tag was pushed to GitHub

Tag the validated v5 docker image to the GitHub tag
$ docker tag rivers-lit us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v0.1.4

Push the GitHub tag Docker image to the Artifact Registry
$ docker push us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v0.1.4

<https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-frontend/rivers-lit?hl=en&inv=1&invt=AbzOFg&project=river-level-0> - Note the served docker version that is verified now has a tag that is reflected in GitHub for tracking.

Cleanup - delete old artifacts in the Google Cloud repo, you pay for storage <https://console.cloud.google.com/artifacts?referrer=search&hl=en&inv=1&invt=AbyvEw&project=river-level-0>

Congrats, you now modified the rivers frontend, tested it, and deployed it with good tags for tracking in GitHub and Google Cloud.

## Docker Debugging

TODO - document how to debug Docker apps
Set PORT and run the Docker container
$ docker run -p 8080:8080 -e PORT=8080 rivers-lit
Read the output to know how to access the website with the URL

## Cloud Run

Use Cloud Run custom domains to take domain in Squarespace and host the new Cloud Run instance
with a new subdomain

### Custom Domains

Google Cloud Run > Home > Manage Custom Domains > New Domain > choose Cloud run instance > choose domain > choose new subdomain (e.g. api.rivers) > See generated DNS record

### Squarespace Domains

Copy new Google Cloud DNS record into Squarespace Domains (from Cloud Run > Manage Custom Domains) > Domains > Custom Records > Add Google records (Host = Name, Alias Data = Data, Type = Type)

## TODO

- ~~Bug fix: fix Lit graph x-axis formatting issue - only shows time~~
- ~~Change structure of html and typescirpt to allow links to particular dashboards (url#river_name)~~
- ~~Add Terms of Use page, create a separate page~~
- ~~Delete riverdetails gaugeName properties, (workaround need now removed)~~
- ~~Fix river graph disappears when runnable toggle clicked~~
- ~~Create Dockerfile - deploy to Cloud Run~~
- ~~Add CSS to about.html~~
- ~~Make timezone change in chart.js based on client timezone~~
- ~~Change ft3/s to cubic feet per second CFS~~
- Create simplified slug code
- Simplify Lit Component
- Use Apple style toggle for sorting vs button

### Long-term TODO

- Add user login capability
  - Allow saving chart positions
  - Allow setting timezone (or have the client set it)
  - Favorite charts
  - Add a form for users to submit river links
  - Create tailwind css
  - Change river-level file names or river-levels file names to rivers project

### Production

- Verify I put Lit in production mode by using | $ npm run prod:build | in the Dockerfile
- Verify that Cloud Run backend deployment is set to production env after frontend deployment
- Fix Network error when putting in ENVIRONMENT production in the Cloud Run instance (CORS issue)
- Apply principle of least privilege to Google Service Accounts for Cloud Run
- Verify that only frontend clients can call the Flask API
