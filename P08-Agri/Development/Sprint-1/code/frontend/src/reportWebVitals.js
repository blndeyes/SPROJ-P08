// measure core web vitals and pass each metric to a callback
// use it to log to console or send to analytics
const reportWebVitals = onPerfEntry => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    // load web vitals only when needed
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      // cumulative layout shift
      getCLS(onPerfEntry);
      // first input delay
      getFID(onPerfEntry);
      // first contentful paint
      getFCP(onPerfEntry);
      // largest contentful paint
      getLCP(onPerfEntry);
      // time to first byte
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
