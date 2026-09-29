/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@nestjs/common$': '<rootDir>/testing/nest-common-shim.js',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          strict: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.spec.ts', '!main.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
