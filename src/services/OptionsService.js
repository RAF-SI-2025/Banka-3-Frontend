export const getOptions = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        currentPrice: 105,
        options: [
          {strike:90, call:{bid:12,ask:13,volume:120,openInterest:300}, put:{bid:1,ask:2,volume:80,openInterest:150}},
          {strike:100, call:{bid:7,ask:8,volume:200,openInterest:500}, put:{bid:3,ask:4,volume:150,openInterest:320}},
          {strike:105, call:{bid:5,ask:6,volume:250,openInterest:600}, put:{bid:5,ask:6,volume:210,openInterest:550}},
          {strike:110, call:{bid:3,ask:4,volume:180,openInterest:400}, put:{bid:7,ask:8,volume:260,openInterest:620}},
          {strike:120, call:{bid:1,ask:2,volume:90,openInterest:200}, put:{bid:12,ask:13,volume:300,openInterest:700}},
        ]
      })
    }, 500)
  })
}