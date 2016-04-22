// Type definitions for edwardhotchkiss/short 2.6.0
// Project: https://github.com/edwardhotchkiss/short/blob/master/package.json
// Definitions by: Dung Huynh <https://github.com/jellydn/>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/// <reference path="../node/node.d.ts" />

declare module 'short' {
    namespace short {
        export interface Short {
            connection: {
                db: string;
                on(status: string, callback: any);
            };
            connect(db: string): void;
            retrieve(param: string): any;
            generate(param: any): any;

        }
    }
    var sh: short.Short;
    export = sh;
}
