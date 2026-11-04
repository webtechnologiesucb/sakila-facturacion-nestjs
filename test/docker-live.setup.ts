/**
 * Habilita la suite de despliegue real cuando se ejecuta con
 * `npm run test:docker:live`. La suite de e2e normal la omite.
 */
process.env.RUN_DOCKER_DEPLOYMENT_TESTS = 'true';
