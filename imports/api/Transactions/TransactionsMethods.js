import { Meteor } from 'meteor/meteor';
import { LoggedInMixin } from 'meteor/tunifight:loggedin-mixin';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';

import Transactions from './TransactionsCollection';
import {TransactionsSchemaSchema} from "./TransactionsSchema";
import Games from '../Games/GamesCollection';


const TransactionsAdd = new ValidatedMethod({
  name: 'Transactions.add',
  mixins: [LoggedInMixin],
  checkLoggedInError: {
    error: 'notLogged',
    message: 'You need to be logged in to call this method',
    reason: 'You need to login',
  },
  validate: TransactionsSchemaSchema.validator(),
  run: (transaction) => {
    // TODO maybe create a mixin
    if (! Meteor.isServer) {
      throw new Meteor.Error("403", "Forbidden!");
    }
    const game = Games.findOne(transaction.gameId);
    if (!game){
      throw new Meteor.Error("500", "Game doesn't exist!");
    }
    return Transactions.insert(transaction);
  },
});


export const TransactionsAddFundsForGame = (gameId) => {
  if (! Meteor.isServer) {
    throw new Meteor.Error("403", "Forbidden!");
  }
  if (! Meteor.userId) {
    throw new Meteor.Error("403", "Forbidden!");
  }
  const {stash} = Games.findOne(gameId, {fields: {startedAt: 1, maxPlayers: 1, stash: 1}});
  const user = Meteor.user();
  let total = user.amount || 0;
  // TODO maybe we should use aggregate here
  Transactions.find({userId: Meteor.userId()}).map(function(doc) {
    if (doc.type === 'out'){
      total -= doc.amount;
    } else if (doc.type === 'in'){
      total += doc.amount;
    }
  });
  if (total < stash){
    throw new Meteor.Error("500", "You don't have enough money for this game");
  }
  return TransactionsAdd.call({type: 'out', amount: stash, userId: Meteor.userId(), gameId: gameId});
}

export const TransactionsWithdrawFundsFromGame = (gameId) => {
  if (! Meteor.isServer) {
    throw new Meteor.Error("403", "Forbidden!");
  }
  if (! Meteor.userId) {
    throw new Meteor.Error("403", "Forbidden!");
  }
  const game =  Games.findOne(gameId);
  const ruleSet = game.ruleset();
  const {expectations, messages} = ruleSet.getState();
  const isFinished = ruleSet.isGameFinished();
  if (!isFinished) {
    throw new Meteor.Error("500", "Game in not finished!");
  }

  _.each(game.players().fetch(), (player, index, players) => {
    const lastRound = _.last(_.filter(messages, i => i.type === 'Round'));
    if (lastRound && lastRound.result) {
      const currentPlayerResult = _.find(lastRound.result, i => i.playerId === player._id);
      if (currentPlayerResult && currentPlayerResult.total) {
        //    if there will be an error here database will become inconsistent.
        // if (index > 0){
        //   throw new Meteor.Error("500", "Random error");
        // }
        TransactionsAdd.call({type: 'in', amount: currentPlayerResult.total, userId: player.userId, gameId: gameId});
      }
    }
  });

  return true;
}