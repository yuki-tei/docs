import React from 'react';
import { Container, Row, Col, Badge } from 'react-bootstrap';
import { graphql } from 'gatsby';
import {
  Footer,
  Layout,
  MainContent,
  SideNavigation,
  TopBar,
} from '../components';

export const query = graphql`
  query($nodeId: String!) {
    openApiSpec(id: { eq: $nodeId }) {
      name
      description
      title
      childrenOpenApiSpecPath {
        fullPath
        summary
        tag
        verb
        childrenOpenApiSpecResponse {
          statusCode
          description
        }
      }
    }
  }
`;

const ContentRow = ({ children }) => (
  <div className="container p-0 mt-4">
    <Row>{children}</Row>
  </div>
);

const StatusBadge = ({ code }) => {
  const codeToVariant = (code) => {
    const numCode = parseInt(code);
    if (!numCode) return 'success';

    return numCode >= 400 ? 'warning' : 'success';
  };

  return (
    <Badge variant={codeToVariant(code)} className="mr-3">
      {code}
    </Badge>
  );
};

const OpenApiEndpoint = ({
  verb,
  fullPath,
  summary,
  childrenOpenApiSpecResponse: responses,
}) => {
  return (
    <div className="mt-5">
      <h2>
        <Badge variant="primary" className="mr-3">
          {verb.toUpperCase()}
        </Badge>
        <code>{fullPath}</code>
      </h2>
      <p>{summary}</p>
      <ul className="list-unstyled ml-3">
        {responses.map((response) => {
          return (
            <li>
              <StatusBadge code={response.statusCode} />
              <span>{response.description}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const OpenApiTemplate = ({ data }) => {
  const node = data.openApiSpec;
  const title = node.title;

  return (
    <Layout pageMeta={{}}>
      <TopBar />
      <Container fluid className="p-0 d-flex bg-white">
        <SideNavigation></SideNavigation>
        <MainContent>
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="balance-text">{title}</h1>
          </div>
          <ContentRow>
            <Col xs={12}>
              <div>
                <p>Description: {node.description}</p>
              </div>
              {node.childrenOpenApiSpecPath.map((endpointSpec) => {
                return <OpenApiEndpoint {...endpointSpec} />;
              })}
            </Col>
          </ContentRow>
          <Footer />
        </MainContent>
      </Container>
    </Layout>
  );
};

export default OpenApiTemplate;
