export const login = (email, password) => {
  return new Promise((resolve, reject) => {

    setTimeout(() => {

      // mock user
      if (email === "admin@bank.com" && password === "admin123") {
        resolve({
          accessToken: "mock_access_token_123",
          refreshToken: "mock_refresh_token_123",
          permissions: ["admin"]
        });
      } else {
        reject(new Error("Pogrešan email ili lozinka"));
      }

    }, 500);

  });
};

export const requestPasswordReset = (email) => {
  return new Promise((resolve) => {

    setTimeout(() => {
      console.log("Password reset request for:", email);

      resolve({
        message: "Email za reset lozinke je poslat"
      });
    }, 500);

  });
};