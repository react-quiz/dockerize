// Type definitions for edwardhotchkiss/short 2.6.0
// Project: https://github.com/edwardhotchkiss/short/blob/master/package.json
// Definitions by: Dung Huynh <https://github.com/jellydn/>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/// <reference path="../node/node.d.ts" />

declare module 'handlebars' {
    namespace handlebar {
        export interface handlebars {
            registerHelper(param: string, callback: any): void;
            SafeString(param: string): void;
            compile(template: string): string;
        }
    }
    var obj: handlebar.handlebars;
    export = obj;
}
