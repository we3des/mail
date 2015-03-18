'use strict';

var RETRY_INTERVAL = 10000;

var PublicKeyVerifierCtrl = function($scope, $location, $q, $timeout, $interval, auth, publickeyVerifier, keychain) {
    $scope.retries = 0;

    /**
     * Runs a verification attempt
     */
    $scope.verify = function() {
        if ($scope.busy) {
            return;
        }

        $scope.busy = true;
        disarmTimeouts();

        return $q(function(resolve) {
            // updates the GUI
            resolve();

        }).then(function() {
            // pre-flight check: is there already a public key for the user?
            return keychain.getUserKeyPair(auth.emailAddress);

        }).then(function(keypair) {
            if (!keypair || !keypair.publicKey) {
                // no pubkey, need to do the roundtrip
                return verifyImap();
            }

            // pubkey has already been verified, we're done here
            return success();

        }).catch(function(error) {
            $scope.busy = false;
            $scope.errMsg = error.message; // display error

            scheduleVerification(); // schedule next verification attempt
        });

        function verifyImap() {
            // retrieve the credentials
            return auth.getCredentials().then(function(credentials) {
                return publickeyVerifier.configure(credentials); // configure imap

            }).then(function() {
                return publickeyVerifier.verify(); // connect to imap to look for the message

            }).then(function() {
                return success();
            });
        }
    };

    function success() {
        return $q(function(resolve) {
            resolve();

        }).then(function() {
            // persist keypair
            return publickeyVerifier.persistKeypair();

        }).then(function() {
            // persist credentials locally (needs private key to encrypt imap password)
            return auth.storeCredentials();

        }).then(function() {
            $location.path('/account'); // go to main account screen
        });
    }

    /**
     * schedules next verification attempt in RETRY_INTERVAL ms (scope.timeout)
     * and sets up a countdown timer for the ui (scope.countdown)
     */
    function scheduleVerification() {
        $scope.timeout = setTimeout($scope.verify, RETRY_INTERVAL);

        // shows the countdown timer, decrements each second
        $scope.countdown = RETRY_INTERVAL / 1000;
        $scope.countdownDecrement = setInterval(function() {
            if ($scope.countdown > 0) {
                $timeout(function() {
                    $scope.countdown--;
                }, 0);
            }
        }, 1000);
    }

    function disarmTimeouts() {
        clearTimeout($scope.timeout);
        clearInterval($scope.countdownDecrement);
    }

    scheduleVerification();
};

module.exports = PublicKeyVerifierCtrl;