import { useEffect, useRef, useState } from "react";

interface Vector {
  x: number;
  y: number;
  func: () => void;
}

const Temp = (props: Vector) => {
  props.func();
  return props.x === 0 ? <div>"loading..."</div> : <div>Hello!!</div>;
};

const Test = () => {
  const counter = useRef(0);

  const cb = () => {
    let cnt = counter.current++;
    console.log();
  };

  useEffect(() => {
    setInterval(() => {}, 1000);
  }, []);

  return <div>Hello</div>;
};

export default Test;
