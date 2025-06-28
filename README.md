# rivers-simple-frontend

Simple HTML, CSS, TypeScript for rivers website <https://rivers.johnblakey.org/>

## Project Goals

Create a frontend that powers a dashboard that is flexible and simple enough to keep adding whitewater features.

## Google Analytics 4 (GA4)

Simple Engagement Report for rivers.johnblakey.org
<https://analytics.google.com/analytics/web/#/p492276620/reports/reportinghub?params=_u..nav%3Dmaui>

GA4 Stream added
<https://analytics.google.com/analytics/web/#/a204943788p492276620/admin/streams/table/>

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

Created package.json scripts

### Run Scripts

$ npm run (name_command)

Created a launch.json file that enables Debugging Extension of TypeScript

### Local Debugging

$ npm run build:full:dev
Combines the individual TypeScript, linting, and server build into one for testing

Then run VSCode "Run and Debug" test with Chrome, works by pointing at Vite dev server

If hitting the production API set env in Cloud Run to "development" vs "production" so that endpoint is available to local frontend.

Modify the .env.local file ENV entry VITE_API_BASE_URL:
production is <https://api.rivers.johnblakey.org>
local version default is <todo_add_url>

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

## Firebase

Add authorized domains for testing with Firebase authorization
<https://console.firebase.google.com/u/0/project/river-level-0/authentication/settings>

## Dockerize Frontend and Deploy to Google Cloud Run

See setup and previous manual deployment and tagging steps at the bottom of this section. Now replaced by cloudbuild.yaml.

### Build Push Deploy to Cloud Run

Increment version tag found in link below (e.g. TAG_NAME=1 -> 2) in command below
<https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-frontend/rivers-lit?inv=1&invt=Abz1yw&project=river-level-0>

```bash
gcloud builds submit --config cloudbuild.yaml . --region=us-west2 --substitutions=SHORT_SHA=latest,TAG_NAME=38
```

See builds and logging at <https://console.cloud.google.com/cloud-build/builds?referrer=search&inv=1&invt=AbzdQA&walkthrough_id=iam--create-service-account&project=river-level-0>

### Tagging

#### GitHub v0.1.0 Tag - Manual

If passing tests, commit these Readme deployment step updates to the test branch, then create a pull request into main, and merge the test branch into main. Then create a tag.

To create the tag, note the last tag using the convention vx.y.z (e.g., v0.1.0 -> v0.1.1) <https://github.com/johnblakey/rivers-simple-frontend/tags> and create the next iteration of the tag of the new tested Docker Image with VS Code > Source Control > ... > Tags > Create Tag > v0.1.8 > "Describe new features or bugfixes"

Push created local tag to GitHub - Manually
$  git push origin v0.1.8
Note that the tag was pushed to GitHub

Add Docker tag
Add GitHub tag to the latest v1 tag that was tested and validated
<https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-frontend/rivers-lit?inv=1&invt=AbzmlA&project=river-level-0>

Modify Revision tag
If v1 and v0.1.6 -> v1-016 > edit the existing v1 tag by adding "-016"
<https://console.cloud.google.com/run/detail/us-west1/rivers-lit/revisions?inv=1&invt=AbzyIQ&project=river-level-0>

#### Checks and Clean-up

Check backend rivers-lit that it is in prod and not open dangerously in dev
<https://console.cloud.google.com/run/detail/us-west1/rivers-lit/revisions?inv=1&invt=AbzeuQ&project=river-level-0>

Cleanup - delete unnecessary images and Cloud run revisions
<https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1?inv=1&invt=AbzmlA&project=river-level-0>

Congrats, you now modified the rivers frontend, tested it, and deployed it with good tags for tracking in GitHub and Google Cloud.

### Docker Build process

Docker image should be lean and delete items not needed after setup (TODO - verify this)
I use "server" to make assets available to website in production build

### Steps

Created artifact repo <https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-backend?hl=en&inv=1&invt=AbyuDg&project=river-level-0> in Google Cloud. Default settings, single region, turned off scanning to save money.

Start the Docker Desktop Apple app and login (see phone)

#### Setup Secrets

TODO - simplify since these are not secrets, then can just be passed as environment variables in cloudbuild

Create secrets locally from files with individual lines of the secret and nothing else.
No multi line files. See naming examples in the gcloud request. Also, verify correct secrets in the .env.local file.
Note that Firebase secrets can be seen here <https://console.firebase.google.com/u/0/project/river-level-0/settings/general/web:MjgyNjQyMmQtODhmMi00MjAzLTg1YWQtODY1NzNiNGVhMmUz> Firebase > river-level-0 project (choose project) >  Project Overview - Gear Icon > Project Settings > note secrets should be the same as the .env.local file

Initial Secrets Setup

```bash
# Ensure you are authenticated with gcloud and have selected the correct project
# gcloud auth login
# gcloud config set project YOUR_PROJECT_ID

# Store each configuration value as a secret.
# Extract these values from your .env.local.<name> file.
gcloud secrets create firebase-api-key --replication-policy="automatic" --data-file=./.env.local.firebase_api_key
gcloud secrets create firebase-auth-domain --replication-policy="automatic" --data-file=- <<< "river-level-0.firebaseapp.com"
gcloud secrets create firebase-project-id --replication-policy="automatic" --data-file=- <<< "river-level-0"
gcloud secrets create firebase-storage-bucket --replication-policy="automatic" --data-file=- <<< "river-level-0.firebasestorage.app"
gcloud secrets create firebase-messaging-sender-id --replication-policy="automatic" --data-file=./.env.local.firebase_messaging_sender_id
gcloud secrets create firebase-app-id --replication-policy="automatic" --data-file=./.env.local.firebase_app_id
# Production API URL
gcloud secrets create api-base-url --replication-policy="automatic" --data-file=- <<< "https://api.rivers.johnblakey.org"
```

TODO - verify, I deleted the secret then reuploaded. Now will deploy new version

Note: If a secret already exists and you want to add a new version, modify the above or use the console.

```bash
# gcloud secrets versions add firebase-api-key --data-file=- <<< "new-value"
```

### Check Secrets in Secret Manager - Google Cloud

Verify <https://console.cloud.google.com/security/secret-manager?referrer=search&hl=en&inv=1&invt=AbzerQ&project=river-level-0> API key is here correctly

### API Key Restrictions - Google Cloud

Google Cloud > API & Services > Credentials > Browser Key vs Web Client (need to verify)
<https://console.cloud.google.com/apis/credentials?chat=true&inv=1&invt=Abze3A&project=river-level-0>

### How to pass secrets to Dockerfile

<https://medium.com/@fermey.paul/how-to-load-environment-variables-from-secret-manager-during-build-time-in-cloud-build-540b2bbfaec6>

### IAM

There are service accounts and user accounts and Google Managed accounts.

To see accounts go here > <https://console.cloud.google.com/iam-admin/iam?inv=1&invt=AbzeuQ&project=river-level-0> IAM tab > Checkbox (Include Google Managed accounts) to see default Google accounts used.

Create a new service account that is named and described on what it does. Then point Cloud Build (or any tool) to use the new account vs the original default account. Test what minimal roles are needed.

TODO - is to reduce permission to the least amount of privilege needed.

#### Verify IAM Account

See the account in the Cloud Build logs here <https://console.cloud.google.com/cloud-build/builds;region=us-west2/ba8af067-4d3f-4521-83a6-2965d68dc055?chat=true&hl=en&inv=1&invt=Abzknw&project=river-level-0> > Execution details - Tab > see IAM account (service Google Managed account)

See the roles attached to an IAM account (sometimes <name>@<project_id>.iam.gserviceaccount.com>)

```bash
gcloud projects get-iam-policy river-level-0 \
  --flatten="bindings[].members" \
  --format='table(bindings.role)' \
  --filter="bindings.members:serviceAccount:cloud-build@river-level-0.iam.gserviceaccount.com"
```

#### Modify IAM Account or Create New IAM Account

For service accounts go to Google Cloud console > river-levels-0 - project > IAM > Service Accounts > follow prompts to create a service account name > note the roles of the IAM account to copy > go to Permissions > Roles > type in name of role from docs or error messsage on role to add to then test if issue resolves. For example I had to use trial and error on cloudbuild.yaml deploy to see needed permissions. Annoying when a deployment takes a couple minutes between role tests.

#### Manual Tagging

TODO - find the exact docker image used in Cloud Run instance
$ docker tag rivers-lit us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v0.1.5
Push Docker tag
$ docker push us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v0.1.5

#### Deprecated - Dockerize the Flask app (TODO - Archive)

Replaced by cloudbuild.yaml gcloug builds command -> $ docker build --platform linux/amd64 -t rivers-lit .

Note - the command here ^ and below use the default behavior that the latest tag is assumed without a tag in the commands. Error note - tried pushing the default Docker build and it wasn't accepted by Google b/c only Linux architecture is accepted, the linux tag above solved it.

Optional - see images in Docker VS Code extension (or $ docker images). Notice the rivers-lit has a "latest" image now (if you saw the previous images that existed on the local machine).

Test docker locally, (be sure the backend Cloud Run is set to "development" or it will not connect)
$ docker run -p 8080:8080 -e PORT=8080 rivers-lit
If the docker image passes testing, move onto the next steps to deploy it.

Note last Docker Image tag currently in the Google Cloud Artifacts <https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-frontend/rivers-lit?hl=en&inv=1&invt=AbzKVw&project=river-level-0>

Tag the next (e.g. v1 -> v2) create docker image version to use in Cloud Run
$ docker tag rivers-lit us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v5

Push the created Docker image tag to the Artifact Registry
$ docker push us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v4

If push fails try to sign into Google Artifact Registry in VSCode terminal. It updates the Docker configuration file. Then try pushing to docker above again.
$ gcloud auth configure-docker us-west1-docker.pkg.dev

Verify the version tag push was successful to the Artifact Registry -> <https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-frontend/rivers-lit?hl=en&inv=1&invt=AbzKVw&project=river-level-0>

Deploy the latest version tag to Cloud Run: go to Cloud Run Console page > <https://console.cloud.google.com/run?hl=en&inv=1&invt=AbyufQ&project=river-level-0> > rivers-backend > settings > Edit & deploy new revision > Containers > Edit Containers > choose Image URL > check version (e.g. v2) image > Select > selected 128 Mib of memory | chose unauthenticated invocation | PORT 8080 choice acts as setting $PORT in the command line
TODO - when prod vs dev added use Revision tags "dev" "prod" as needed

Verify the URL on the <https://console.cloud.google.com/run/detail/us-west1/rivers-flask/revisions?project=river-level-0&hl=en&inv=1&invt=AbyvEw> page shows the latest functional app

Verify <https://rivers.johnblakey.org/> is showing the latest functional app

If not passing, verify the same bug in local testing. Fix and start process again.

If passing the test, commit these Readme deployment step updates to the test branch, then create a pull request into main, and merge the test branch into main. Then create a tag.

To create the tag, note the last tag using the convention vx.y.z (e.g., v0.1.0 -> v0.1.1) <https://github.com/johnblakey/rivers-simple-backend/tags> and create the next iteration of the tag of the new tested Docker Image with VS Code > Source Control > ... > Tags > Create Tag > v0.1.4 > "Describe new features or bugfixes"

Push created local tag to GitHub
$  git push origin v0.1.4
Note that the tag was pushed to GitHub

Tag the validated v5 docker image to the GitHub tag
$ docker tag rivers-lit us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v0.1.4

Push the GitHub tag Docker image to the Artifact Registry
$ docker push us-west1-docker.pkg.dev/river-level-0/rivers-frontend/rivers-lit:v0.1.4

<https://console.cloud.google.com/artifacts/docker/river-level-0/us-west1/rivers-frontend/rivers-lit?hl=en&inv=1&invt=AbzOFg&project=river-level-0> - Note the served docker version that is verified now has a tag that is reflected in GitHub for tracking.

Cleanup - delete old artifacts in the Google Cloud repo, you pay for storage <https://console.cloud.google.com/artifacts?referrer=search&hl=en&inv=1&invt=AbyvEw&project=river-level-0>

Congrats, you now modified the rivers frontend, tested it, and deployed it with good tags for tracking in GitHub and Google Cloud.

## Local Docker Debugging

TODO - document how to debug Docker apps
Set PORT and run the Docker container
$ docker run -p 8080:8080 -e PORT=8080 rivers-lit
Read the output to know how to access the website with the URL

## Cloud Run

Use Cloud Run > Custom domains - to take domain in Squarespace and host the new Cloud Run instance
with a new subdomain

### Deployed Cloud Run Debugging

Add debugging statements into configs and Dockerfile then see results in logs and the browser

### Custom Domains

Google Cloud Run > Home > Manage Custom Domains > New Domain > choose Cloud run instance > choose domain > choose new subdomain (e.g. api.rivers) > See generated DNS record

### Squarespace Domains

Copy new Google Cloud DNS record into Squarespace Domains (from Cloud Run > Manage Custom Domains) > Domains > Custom Records > Add Google records (Host = Name, Alias Data = Data, Type = Type)

## Beta Attempts

### Identity Aware Proxy (IAP)

<https://console.cloud.google.com/security/iap?hl=en&inv=1&invt=AbzwBg&project=river-level-0>

## TODO

### ~~Authentication TODO~~

- ~~Add user login capability (use Google Cloud authentication | Firebase | Datastore)~~
- ~~Favorite charts pinned to top~~
- ~~Fix avatar not uploading~~
- ~~Verify saving chart positions~~
- ~~Change look of my button to the Google Login button~~

### Short-term TODO

- ~~Bug fix: fix Lit graph x-axis formatting issue - only shows time~~
- ~~Change structure of html and typescirpt to allow links to particular dashboards (url#river_name)~~
- ~~Add Terms of Use page, create a separate page~~
- ~~Delete riverdetails gaugeName properties, (workaround need now removed)~~
- ~~Fix river graph disappears when runnable toggle clicked~~
- ~~Create Dockerfile - deploy to Cloud Run~~
- ~~Add CSS to about.html~~
- ~~Make timezone change in chart.js based on client timezone~~
- ~~Change ft3/s to cubic feet per second CFS~~
- ~~Use Apple style toggle for sorting vs button~~
- ~~Fix chart label overlap on mobile~~
- ~~Make the condensed table view~~
- ~~Make modified expanded view~~
- Make email alerts option
- ~~Add private notes~~
- Allow manually setting timezone (default is use the client to set it)
- Allow rearranging (arrows? drag them?)
- ~~Favorite charts pinned to top and save the new arrangement~~
- Reduce roles on Service accounts by replacing with user created simplified service account <https://console.cloud.google.com/iam-admin/iam?inv=1&invt=AbzeuQ&project=river-level-0> and <https://console.cloud.google.com/iam-admin/serviceaccounts?inv=1&invt=AbzeuQ&project=river-level-0> theres an auto-generated account
- Can I lock down APIs more?
- I need to verify how to run local and test vs deploy to Cloud Run and test
- Allow user to save type of sort chosen (alphabetical vs current) - backend change needed
- Simplify injecting Firebase credentials (secret manager still injects directly into Dockerfile - is readable by users directly)

### Long-term TODO

- Add a form for users to submit river links
- Create tailwind css
- ~~Change river-level file names or river-levels file names to rivers project~~
- Simplify slug code
- Simplify Lit Component
- Simplify User Authentication
- ~~Simplify data.ts pulling data (rename?)~~
- Refactor utility files naming and scope
- Use security recommendations here <https://owasp.org/www-project-top-ten/> to this project and add to mega-reference

### Production Checks

- Verify I put Lit in production mode by using | $ npm run prod:build | in the Dockerfile (is there a waring in the browser console about it?)
- Verify that Cloud Run backend deployment is set to production env after frontend deployment (no warning - verify manually <https://console.cloud.google.com/run/detail/us-west1/rivers-flask/revisions?project=river-level-0&inv=1&invt=AbzmZg>)
- Apply principle of least privilege to Google Service Accounts for Cloud Run
- Simplify CORS and development, currently development Env is required in Cloud Run to allow test frontends to access river levels, but a config in the frontend (.env.local (see comments there)) is needed to manually point to a local backend API instance, need to sort out, does not make sense
