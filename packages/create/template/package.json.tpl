{
  "name": "{{packageName}}",
  "private": true,
  "version": "0.1.0",
  "description": "{{description}}",
  "author": "{{author}}",
  "type": "module",
  "scripts": {
    "typecheck": "tsc",
    "build": "busy-cli build"
  },
  "engines": {
    "node": ">=24 <26"
  },
  "devDependencies": {
    "@busy-app/cli": "^0.4.0",
    "typescript": "~6.0.3",
    "vite": "8.1.4"
  },
  "dependencies": {
    "@busy-app/busy-lib": "^0.21.1"
  }
}
