/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  testTimeout: 30000,
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
};
