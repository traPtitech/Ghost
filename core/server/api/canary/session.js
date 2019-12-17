const Promise = require('bluebird');
const common = require('../../lib/common');
const models = require('../../models');
const auth = require('../../services/auth');

const session = {
    read(frame) {
        /*
         * TODO
         * Don't query db for user, when new api http wrapper is in we can
         * have direct access to req.user, we can also get access to some session
         * inofrmation too and send it back
         */
        return models.User.findOne({id: frame.options.context.user});
    },
    add(frame) {
        return require('../../trap-auth').signIn().then((user) => {
            return Promise.resolve((req, res, next) => {
                req.brute.reset(function (err) {
                    if (err) {
                        return next(err);
                    }
                    req.user = user;
                    auth.session.createSession(req, res, next);
                });
            });
        }).catch((err) => {
            throw new common.errors.UnauthorizedError({
                message: common.i18n.t('errors.middleware.auth.accessDenied'),
                err
            });
        });
    },
    delete() {
        return Promise.resolve((req, res, next) => {
            auth.session.destroySession(req, res, next);
        });
    }
};

module.exports = session;
