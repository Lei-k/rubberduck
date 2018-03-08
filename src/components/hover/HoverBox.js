import React from "react";
import PropTypes from "prop-types";
import Docstring from "../common/Docstring";
import CodeNode from "../common/CodeNode";
import "./Hover.css";
import { decodeBase64 } from "../../utils/data";

export default class HoverBox extends React.Component {
  // Presentation component for the hover box
  static propTypes = {
    name: PropTypes.string,
    docstring: PropTypes.string,
    lineNumber: PropTypes.number,
    charNumber: PropTypes.number,
    filePath: PropTypes.string,
    fileSha: PropTypes.string,
    x: PropTypes.number,
    y: PropTypes.number,
    onReferences: PropTypes.func,
    onDefinition: PropTypes.func
  };

  render() {
    return (
      <div
        className="hover-box"
        style={{
          left: this.props.x,
          bottom: window.innerHeight - this.props.y
        }}
      >
        <div className="title">
          <CodeNode
            name={this.props.name}
            file={this.props.filePath}
            showButton={false}
          />
        </div>
        <div className="docstring">
          {Docstring(decodeBase64(this.props.docstring || ""))}
        </div>
        <div className="button-container">
          <a className="button" onClick={this.props.onReferences}>
            Find usages
          </a>{" "}
          <a className="button" onClick={this.props.onDefinition}>
            Open definition
          </a>
        </div>
      </div>
    );
  }
}
