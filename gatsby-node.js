// this patch is required to consistently load all the doc files
const realFs = require('fs');
const gracefulFs = require('graceful-fs');
gracefulFs.gracefulify(realFs);

const { createFilePath } = require(`gatsby-source-filesystem`);
const { exec, execSync } = require('child_process');

const isBuild = process.env.NODE_ENV === 'production';
const isProduction = process.env.APP_ENV === 'production';

const sortVersionArray = versions => {
  return versions
    .map(version => version.replace(/\d+/g, n => +n + 100000))
    .sort()
    .map(version => version.replace(/\d+/g, n => +n - 100000));
};

const replacePathVersion = (path, version = 'latest') => {
  const splitPath = path.split('/');
  const postVersionPath = splitPath.slice(3).join('/');
  return `/${splitPath[1]}/${version}${
    postVersionPath.length > 0 ? `/${postVersionPath}` : ''
  }`;
};

const filePathToDocType = filePath => {
  if (filePath.includes('/product_docs/')) {
    return 'doc';
  } else if (filePath.includes('/advocacy_docs/')) {
    return 'advocacy';
  } else {
    return 'gh_doc';
  }
};

const legacyProductName = {
  ark: 'EDB Postgres Ark Platform',
  bart: 'EDB Backup and Recovery Tool',
  efm: 'EDB Postgres Failover Manager',
  epas: 'EDB Postgres Advanced Server',
  hadoop_data_adapter: 'EDB Postgres Hadoop Foreign Data Wrapper',
  jdbc_connector: 'EDB JDBC Connector',
  migration_portal: 'EDB Postgres Migration Portal',
  migration_toolkit: 'EDB Postgres Migration Toolkit',
  net_connector: 'EDB .NET Connector',
  ocl_connector: 'EDB OCL Connector',
  odbc_connector: 'EDB ODBC Connector',
  pem: 'EDB Postgres Enterprise Manager',
  pgbouncer: 'EDB Postgres PgBouncer',
  pgpool: 'EDB Postgres Pgpool-II',
  postgis: 'EDB Postgres PostGIS',
  slony: 'EDB Postgres Slony Replication',
};

const products = {};
const scraped_data = JSON.parse(
  gracefulFs.readFileSync('legacy_docs_scrape_dec_17.json'),
);
scraped_data.forEach(entry => {
  const { product, version, ...details } = entry;
  products[product] = products[product] || {};
  products[product][version] = products[product][version] || [];
  products[product][version].push(details);
});

const findRedirectMatch = (doc, docPath) => {
  let possibleMatches =
    products[legacyProductName[doc.fields.product]][
      doc.fields.version.toString()
    ];
  possibleMatches = possibleMatches.filter(m =>
    m.title.toLowerCase().includes(doc.frontmatter.title.toLowerCase()),
  );
  // if (possibleMatches > 1) {
  //   possibleMatches = possibleMatches.filter(m =>
  //     m.nav.find(n => n.toLowerCase().includes(docPath[0].toLowerCase()))
  //   );
  // }
  // console.log(possibleMatches.length + ' possible matches');
  // if (possibleMatches.length === 2) {
  //   console.log(`${doc.fields.product} ${doc.fields.version} ${doc.frontmatter.title} ${doc.fields.path}`);
  //   console.log(docPath);
  //   console.log(possibleMatches);
  // }

  const splitNewPath = doc.fields.path.split('/');
  const newPage = splitNewPath[splitNewPath.length - 1].replace(/^\d*_/, '');
  console.log(newPage);

  possibleMatches = possibleMatches.filter(m => {
    const oldPage = m.url
      .split('/')
      [m.url.split('/').length - 1].replace('.html', '');
    console.log(oldPage);
    return oldPage === newPage;
  });

  console.log(possibleMatches.length + ' possible matches');

  // maybe try comparing the last section of the URLs? need to normalize to remove leading numbers and extension
};

const productLatestVersionCache = [];

exports.onCreateNode = async ({ node, getNode, actions }) => {
  const { createNodeField } = actions;

  if (node.internal.type === 'Mdx') {
    const fileNode = getNode(node.parent);
    const nodeFields = {
      docType: filePathToDocType(node.fileAbsolutePath),
      mtime: fileNode.mtime,
    };

    const relativeFilePath = createFilePath({
      node,
      getNode,
    }).slice(0, -1); // remove last character

    Object.assign(nodeFields, {
      path: relativeFilePath,
    });

    if (nodeFields.docType === 'doc') {
      Object.assign(nodeFields, {
        product: relativeFilePath.split('/')[1],
        version: relativeFilePath.split('/')[2],
        topic: 'null',
      });
    } else if (nodeFields.docType === 'advocacy') {
      Object.assign(nodeFields, {
        product: 'null',
        version: '0',
        topic: relativeFilePath.split('/')[2],
      });
    } else {
      // gh_doc
      Object.assign(nodeFields, {
        product: 'null',
        version: '0',
        topic: relativeFilePath.split('/')[1],
      });
    }

    for (const [name, value] of Object.entries(nodeFields)) {
      createNodeField({ node, name: name, value: value });
    }
  }
};

exports.createPages = async ({ actions, graphql, reporter }) => {
  const result = await graphql(`
    query {
      allMdx {
        nodes {
          frontmatter {
            title
            navTitle
            description
            redirects
            iconName
            katacodaPages {
              scenario
              account
            }
            originalFilePath
          }
          excerpt(pruneLength: 280)
          fields {
            docType
            path
            product
            version
            topic
          }
          fileAbsolutePath
        }
      }
    }
  `);

  const { nodes } = result.data.allMdx;

  if (result.errors) {
    reporter.panic('failed to create docs', result.errors);
  }

  for (let node of nodes) {
    if (!node.frontmatter.title) {
      let file;
      if (node.fileAbsolutePath.includes('index.mdx')) {
        file = node.fields.path + '/index.mdx';
      } else {
        file = node.fields.path + '.mdx';
      }
      reporter.warn(file + ' has no title');
    }
  }

  const docs = nodes.filter(file => file.fields.docType === 'doc');
  const learn = nodes.filter(file => file.fields.docType === 'advocacy');
  const gh_docs = nodes.filter(file => file.fields.docType === 'gh_doc');

  const folderIndex = {};

  nodes.forEach(doc => {
    const { path } = doc.fields;
    const { redirects } = doc.frontmatter;

    if (redirects) {
      redirects.forEach(fromPath => {
        actions.createRedirect({
          fromPath,
          toPath: path,
          redirectInBrowser: true,
          isPermanent: true,
        });
      });
    }

    const splitPath = path.split('/');
    const subPath = splitPath.slice(0, splitPath.length - 1).join('/');
    const { fileAbsolutePath } = doc;
    if (fileAbsolutePath.includes('index.mdx')) {
      folderIndex[path] = true;
    } else {
      if (!folderIndex[subPath]) {
        folderIndex[subPath] = false;
      }
    }
  });

  for (let key of Object.keys(folderIndex)) {
    if (!folderIndex[key]) {
      reporter.warn(key + ' has no index.mdx');
    }
  }

  const versionIndex = {};

  docs.forEach(doc => {
    const { product, version } = doc.fields;

    if (!versionIndex[product]) {
      versionIndex[product] = [version];
    } else {
      if (!versionIndex[product].includes(version)) {
        versionIndex[product].push(version);
      }
    }
  });

  for (const product in versionIndex) {
    versionIndex[product] = sortVersionArray(versionIndex[product]).reverse();
  }

  docs.forEach(doc => {
    const { path, product, version } = doc.fields;
    const { title } = doc.frontmatter;

    const navLinks = docs.filter(
      node =>
        node.fields.product === doc.fields.product &&
        node.fields.version === doc.fields.version,
    );

    const isLatest = versionIndex[doc.fields.product][0] === doc.fields.version;
    if (isLatest) {
      actions.createRedirect({
        fromPath: doc.fields.path,
        toPath: replacePathVersion(doc.fields.path),
        redirectInBrowser: true,
        isPermanent: false,
        force: true,
      });
    }

    if (product === 'bart' && version.toString() === '2.6') {
      console.log(`${product} ${version} ${title} ${path}`);
      const docPath = [];
      let splitPath = path.split('/');
      let i = 0;
      // console.log(navLinks);
      while (splitPath[splitPath.length - 1] != product) {
        i++;
        if (i > 10) {
          console.log('loop failed to exit');
          break;
        }
        splitPath.pop();
        const parent = navLinks.find(
          doc => doc.fields.path === splitPath.join('/'),
        );
        if (parent) {
          docPath.push(parent.frontmatter.title);
        }
      }
      console.log(docPath);
      findRedirectMatch(doc, docPath);
      console.log('');
    }

    const docsRepoUrl = 'https://github.com/EnterpriseDB/docs';
    const branch = isProduction ? 'main' : 'develop';
    const fileUrlSegment =
      doc.fields.path +
      (doc.fileAbsolutePath.includes('index.mdx') ? '/index.mdx' : '.mdx');
    const githubFileLink = `${docsRepoUrl}/commits/${branch}/product_docs/docs${fileUrlSegment}`;
    const githubEditLink = `${docsRepoUrl}/edit/${branch}/product_docs/docs${fileUrlSegment}`;
    const githubIssuesLink = `${docsRepoUrl}/issues/new?title=Feedback%20on%20${encodeURIComponent(
      fileUrlSegment,
    )}`;

    actions.createPage({
      path: isLatest ? replacePathVersion(doc.fields.path) : doc.fields.path,
      component: require.resolve('./src/templates/doc.js'),
      context: {
        navLinks: navLinks,
        versions: versionIndex[doc.fields.product],
        nodePath: doc.fields.path,
        githubFileLink: githubFileLink,
        githubEditLink: githubEditLink,
        githubIssuesLink: githubIssuesLink,
        potentialLatestPath: replacePathVersion(doc.fields.path), // the latest url for this path (may not exist!)
        potentialLatestNodePath: replacePathVersion(
          doc.fields.path,
          versionIndex[doc.fields.product][0],
        ), // the latest version number path (may not exist!), needed for query
      },
    });
  });

  learn.forEach(doc => {
    const navLinks = learn.filter(
      node => node.fields.topic === doc.fields.topic,
    );

    const advocacyDocsRepoUrl = 'https://github.com/EnterpriseDB/docs';
    const branch = isProduction ? 'main' : 'develop';
    const fileUrlSegment =
      doc.fields.path +
      (doc.fileAbsolutePath.includes('index.mdx') ? '/index.mdx' : '.mdx');
    const githubFileLink = `${advocacyDocsRepoUrl}/commits/${branch}/advocacy_docs${fileUrlSegment}`;
    const githubEditLink = `${advocacyDocsRepoUrl}/edit/${branch}/advocacy_docs${fileUrlSegment}`;
    const githubIssuesLink = `${advocacyDocsRepoUrl}/issues/new?title=Regarding%20${encodeURIComponent(
      fileUrlSegment,
    )}`;

    actions.createPage({
      path: doc.fields.path,
      component: require.resolve('./src/templates/learn-doc.js'),
      context: {
        navLinks: navLinks,
        githubFileLink: githubFileLink,
        githubEditLink: githubEditLink,
        githubIssuesLink: githubIssuesLink,
      },
    });

    (doc.frontmatter.katacodaPages || []).forEach(katacodaPage => {
      if (!katacodaPage.scenario || !katacodaPage.account) {
        throw new Error(
          `katacoda scenario or account missing for ${doc.fields.path}`,
        );
      }

      actions.createPage({
        path: `${doc.fields.path}/${katacodaPage.scenario}`,
        component: require.resolve('./src/templates/katacoda-page.js'),
        context: {
          ...katacodaPage,
          learn: {
            title: doc.frontmatter.title,
            description: doc.frontmatter.description,
          },
        },
      });
    });
  });

  gh_docs.forEach(doc => {
    let githubLink = 'https://github.com/EnterpriseDB/edb-k8s-doc';
    if (doc.fields.path.includes('barman')) {
      githubLink = 'https://github.com/2ndquadrant-it/barman';
    }
    const showGithubLink = !doc.fields.path.includes('pgbackrest');

    const navLinks = gh_docs.filter(
      node => node.fields.topic === doc.fields.topic,
    );

    const githubFileLink = `${githubLink}/tree/master/${(
      doc.frontmatter.originalFilePath || ''
    ).replace('README.md', '')}`;
    const githubFileHistoryLink = `${githubLink}/commits/master/${doc.frontmatter.originalFilePath}`;

    actions.createPage({
      path: doc.fields.path,
      component: require.resolve('./src/templates/gh-doc.js'),
      context: {
        navLinks: navLinks,
        githubFileLink: showGithubLink ? githubFileLink : null,
        githubFileHistoryLink: showGithubLink ? githubFileHistoryLink : null,
      },
    });
  });

  const sha = await new Promise((resolve, reject) => {
    exec('git rev-parse HEAD', (error, stdout, stderr) => resolve(stdout));
  });

  const branch = await new Promise((resolve, reject) => {
    exec('git branch --show-current', (error, stdout, stderr) =>
      resolve(stdout),
    );
  });

  actions.createPage({
    path: 'build-info',
    component: require.resolve('./src/templates/build-info.js'),
    context: {
      sha: sha,
      branch: branch,
      buildTime: Date.now(),
    },
  });
};

exports.sourceNodes = ({
  actions: { createNode },
  createNodeId,
  createContentDigest,
}) => {
  const activeSources = ['advocacy'];

  if (!process.env.SKIP_SOURCING) {
    const sources = JSON.parse(
      gracefulFs.readFileSync(
        isBuild ? 'build-sources.json' : 'dev-sources.json',
      ),
    );
    for (const [source, enabled] of Object.entries(sources)) {
      if (enabled) {
        activeSources.push(source);
      }
    }
  }

  const nodeData = { activeSources: activeSources };

  createNode({
    ...nodeData,
    id: createNodeId('edb-sources'),
    internal: {
      type: 'edbSources',
      contentDigest: createContentDigest(nodeData),
    },
  });
};

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;
  const typeDefs = `
    type Mdx implements Node {
      frontmatter: Frontmatter
    }

    type Frontmatter {
      originalFilePath: String
    }
  `;
  createTypes(typeDefs);
};

exports.onPreBootstrap = () => {
  console.log(`
 _____  ____   _____    ____                 
|   __||    \\ | __  |  |    \\  ___  ___  ___ 
|   __||  |  || __ -|  |  |  || . ||  _||_ -|
|_____||____/ |_____|  |____/ |___||___||___|
                                                                                                                   
  `);
};
