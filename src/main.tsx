import { bootstrap } from "@/app/bootstrap";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Application root element was not found.");
}

bootstrap(root);
