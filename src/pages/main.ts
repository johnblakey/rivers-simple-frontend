// main.ts

function greeter(person: string) {
  return "Hello, " + person;
}

const user = "John Blakey";

document.body.textContent = greeter(user);
