import React from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { github as githubStyle } from "react-syntax-highlighter/styles/hljs";

import SectionHeader from "./common/Section";
import ExpandedCode from "./common/ExpandedCode";
import CodeNode from "./common/CodeNode";
import "./References.css";

const references = [
  {
    name: "send_shutdown",
    codeSnippet:
      "ICAgIGRlZiBzZW5kX3NodXRkb3duKHNlbGYpOg0KICAgICAgICAnJycNCiAgICAgICAgU2VuZHMgYSBzaHV0ZG93biBtZXNzYWdlIHRvIHRoZSBzZXJ2ZXIgZnJvbSB0aGUgY2xpZW50DQogICAgICAgIHdoaWNoIHNodXRzIGRvd24gdGhlIHNlcnZlci4gVGhpcyBtZXRob2QgaXMgY2FsbGVkIHdpdGgNCiAgICAgICAgdGhlIF9fZXhpdF9fKCkgbWV0aG9kLg0KICAgICAgICAnJycNCiAgICAgICAgbXNnX2lkID0gc2VsZi5zZW5kX21lc3NhZ2UoJ3NodXRkb3duJywge30pDQogICAgICAgIHJldHVybiBzZWxmLmdldF9yZXNwb25zZShtc2dfaWQp",
    file: "apps/ls_clients/base.py",
    line: "msg_id = self.send_message('shutdown', {})",
    lineTrimmed: "send_message('shutdown', {})",
    lineNumber: 24
  },
  {
    name: "send_file_did_close",
    codeSnippet:
      "ICAgIGRlZiBzZW5kX2ZpbGVfZGlkX2Nsb3NlKHNlbGYsIGZpbGVfcGF0aCk6DQogICAgICAgICcnJw0KICAgICAgICBTZW5kIGZpbGUgY2xvc2UgcmVxdWVzdCB0byB0aGUgc2VydmVyDQogICAgICAgICcnJw0KICAgICAgICBtc2dfaWQgPSBzZWxmLnNlbmRfbWVzc2FnZSgndGV4dERvY3VtZW50L2RpZENsb3NlJywgew0KICAgICAgICAgICAgJ3RleHREb2N1bWVudCc6IHsNCiAgICAgICAgICAgICAgICAjIFRleHREb2N1bWVudElkZW50aWZpZXIgaW50ZXJmYWNlDQogICAgICAgICAgICAgICAgJ3VyaSc6IGdldF91cmlfZnJvbV9maWxlX3BhdGgoZmlsZV9wYXRoKSwNCiAgICAgICAgICAgIH0NCiAgICAgICAgfSkNCiAgICAgICAgcmV0dXJuIHNlbGYuZ2V0X3Jlc3BvbnNlKG1zZ19pZCk=",
    file: "apps/ls_clients/base.py",
    line: "msg_id = self.send_message('textDocument/didClose', {",
    lineTrimmed: "send_message('textDocument...",
    lineNumber: 34
  },
  {
    name: "send_document_symbols",
    codeSnippet:
      "ICAgIGRlZiBzZW5kX2RvY3VtZW50X3N5bWJvbHMoc2VsZiwgZmlsZV9wYXRoKToNCiAgICAgICAgJycnDQogICAgICAgIFNlbmQgdGV4dERvY3VtZW50L2RvY3VtZW50U3ltYm9sIG1lc3NhZ2UgdG8gZ2V0DQogICAgICAgIHN5bWJvbHMgb2YgdGhlIGRvY3VtZW50LiBXaGVuIHRoaXMgaXMgY2FsbGVkLCBlbnN1cmUNCiAgICAgICAgdGhhdCB0aGUgZG9jdW1lbnRzIGFyZSBvcGVuZWQgYW5kIGNsb3NlZCBvbiB0aGUgc2VydmVyLg0KICAgICAgICAnJycNCiAgICAgICAgbXNnX2lkID0gc2VsZi5zZW5kX21lc3NhZ2UoJ3RleHREb2N1bWVudC9kb2N1bWVudFN5bWJvbCcsIHsNCiAgICAgICAgICAgICMgVGV4dERvY3VtZW50SWRlbnRpZmllciBpbnRlcmZhY2UNCiAgICAgICAgICAgICd0ZXh0RG9jdW1lbnQnOiB7DQogICAgICAgICAgICAgICAgJ3VyaSc6IGdldF91cmlfZnJvbV9maWxlX3BhdGgoZmlsZV9wYXRoKQ0KICAgICAgICAgICAgfQ0KICAgICAgICB9KQ0KICAgICAgICByZXR1cm4gc2VsZi5nZXRfcmVzcG9uc2UobXNnX2lkKQ==",
    file: "apps/ls_clients/base.py",
    line: "msg_id = self.send_message('textDocument/documentSymbol', {",
    lineTrimmed: "send_message('textDocument...",
    lineNumber: 48
  }
];

class ReferenceItem extends React.Component {
  state = {
    isHovering: false
  };

  handleMouseHover = () => {
    this.setState({
      isHovering: !this.state.isHovering
    });
  };

  getTop = () => {
    return this.refs.container.getBoundingClientRect().top;
  };

  render() {
    return (
      <div
        className="reference-item"
        onMouseEnter={this.handleMouseHover}
        onMouseLeave={this.handleMouseHover}
        ref={"container"}
      >
        <CodeNode {...this.props} />

        {/* <div className="reference-item-line">
          <SyntaxHighlighter
            language={"python"}
            style={githubStyle}
            showLineNumbers={true}
            startingLineNumber={this.props.lineNumber}
          >
            {this.props.lineTrimmed}
          </SyntaxHighlighter>
        </div> */}

        {this.state.isHovering ? (
          <ExpandedCode
            language={"python"}
            codeBase64={this.props.codeSnippet}
            top={this.getTop()}
            startLine={this.props.lineNumber}
            filepath={this.props.file}
          />
        ) : null}
      </div>
    );
  }
}

export default class References extends React.Component {
  state = {
    isVisible: false
  };

  toggleVisibility = () => {
    this.setState({
      isVisible: !this.state.isVisible
    });
  };

  render() {
    const referenceItems = references.map((reference, index) => {
      return <ReferenceItem {...reference} key={index} />;
    });

    return (
      <div className="references-section">
        <SectionHeader
          onClick={this.toggleVisibility}
          isVisible={this.state.isVisible}
          name={"References"}
        />
        {this.state.isVisible ? (
          <div className="reference-container">
            <div className="reference-title">
              <div className="reference-name monospace">send_message</div>
              <div className="reference-count">3 references</div>
            </div>
            <div>{referenceItems}</div>{" "}
          </div>
        ) : null}
      </div>
    );
  }
}