module.exports = {
  hooks: {
    readPackage(pkg) {
      if (
        pkg.name === '@EIHRTeam/wiki-upload-wikiplus' &&
        pkg.dependencies &&
        pkg.dependencies['@EIHRTeam/wiki-upload-core'] === 'workspace:*'
      ) {
        pkg.dependencies['@EIHRTeam/wiki-upload-core'] = '0.1.0'
      }

      return pkg
    },
  },
}
