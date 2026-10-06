module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  coveragePathIgnorePatterns: ['/node_modules/'],
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  collectCoverageFrom: ['**/*.service.{js,ts}', '**/middleware/*.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  coverageDirectory: '../coverage/',
};
