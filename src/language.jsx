import React, { createContext, useContext } from "react";

const LanguageContext = createContext("en");

export function LanguageProvider({ language, children }) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
