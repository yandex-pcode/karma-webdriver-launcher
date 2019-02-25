export type WebDriverWindow = {
    /** See https://github.com/admc/wd for full list */
    invokeWD: (string, args: Array<any>) => Promise<any>,
    /** invoke function within native click stack */
    withTrustedClick: (callback: VoidFunction) => void;
}
