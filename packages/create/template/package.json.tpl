{
  "name": "{{packageName}}",
  "private": true,
  "version": "0.1.0",
  "description": "{{description}}",
  "author": "{{author}}",
  "type": "module",
  "scripts": {
    "typecheck": "tsc -b",
    "build": "busy-cli build"
  },
  "engines": {
    "node": ">=24 <26"
  },
  "devDependencies": {
    "@busy-app/cli": "^0.2.0",
    "typescript": "~7.0.2",
    "vite": "8.1.4"
  },
  "dependencies": {
    "@busy-app/busy-lib": "^0.20.0"
  }
}
