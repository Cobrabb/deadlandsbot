const Discord = require('discord.js');
const client = new Discord.Client();

client.once('ready', () => {
  console.log('Deadlands bot Loaded!');
});

function rollSimple(type){
  return Math.floor(Math.random() * (type)) + 1;
}

function coinFlip() {
  return (Math.floor(Math.random() * 2) == 0);
}

function commonRoll(num, type){
  var all = [];
  var ret = 'Raws: [';
  for(var i=0; i<num; i++){
    var roll = rollSimple(type);
    while(roll % type == 0){
      roll += rollSimple(type);
    }
    if(i > 0) ret += ', ';
    ret += roll;
    all.push(roll);
  }
  ret += ']';
  add(ret);
  return all;
}

function roll(num, type){
  return commonRoll(num, type).reduce(function(a, b) { return Math.max(a, b) });
}

function damageRoll(num, type){
  return commonRoll(num, type).reduce((a, b) => a + b, 0);
}

function addToFirstType(string, amt){
  var parts = string.split('+');
  for(var i=0; i<parts.length; i++){
    if(parts[i].includes('d')){
      var spl = parts[i].split('d');  
      var num = parseInt(spl[0], 10) + amt;
      parts[i] = num + 'd' + spl[1];
      break;
    }
  }

  return parts.join('+');
}

function parseRoll(string, damage){
  var parts = string.replace('-', '+-').split('+');
  var total = 0;
  var explainer = '';
  
  for(var i=0; i<parts.length; i++){
    if(explainer != '') explainer += ' + ';
    if(parts[i].includes('d')) {
      var dice = parts[i].split('d');
      var res = 0;
      if (damage) {
        res = damageRoll(dice[0], dice[1]);
      } else {
        res = roll(dice[0], dice[1]);
      }
      total += res;
      explainer += res + ' (' + parts[i] + ')';
    } else {
      var part = parseInt(parts[i], 10);
      total += part;
      explainer += part;
    }
  }

  add('Total: ' + total + ' <<-- ' + explainer);
  return total;
}

function add(string){
  response += string + '\n';
}

function flush(){
  channel.send(response);
  response = '';
}

function fireRifle(skill, incriment, range, damage){
  fire(skill, incriment, range, damage, false);
}

function fireShotgun(skill, incriment, range){
  var damage = '';
  if (range <= 10) {
    damage = '5d6'; 
  } else if (range <= 20 ) {
    damage = '4d6';
  } else if (range <= 30 ) {
    damage = '3d6';
  } else {
    damage = '2d6';
  }
  fire(skill, incriment, range, damage, false);
}

function fireFist(skill, tn, damage){
  var tncalc = 5 - parseRoll(tn);
  var operand = tncalc < 0 ? '' : '+'; 

  fire(skill + operand + tncalc, 1, 0, damage, true);
}

function fire(skill, incriment, range, damage, melee){
  // first, figure out what the TN is.
  var dc = Math.floor(1.0 * range / incriment) + 5;
  add('Rolling to hit (' + skill + ' vs ' + dc + ')');
  var res = parseRoll(skill, false);
  if (res < dc) {
    add('Miss!');
    return;
  }

  var modifier = Math.floor((res - dc) / 5.0);
  var explainer = '(' + modifier + ' raises';

  if (melee) {
    modifier += 2;
    explainer += ', +2 melee bonus';
  }

  explainer += ')';
  add('Rolling hit table at +' + modifier + ' <<-- ' + explainer);
  explainer = '';

  res = parseRoll('1d20+'+modifier, false);
  var part = '';
  if (res <= 4) {
    part = 'leg';
  } else if (res <= 9) {
    part = 'lower guts';
  } else if (res <= 10) {
    part = 'gizzards';
  } else if (res <= 14) {
    part = 'arm';
  } else if (res <= 19) {
    part = 'upper guts';
  } else {
    part = 'noggin';
  }

  if (part == 'arm' || part == 'leg'){
    if (coinFlip()){
      part = 'left ' + part;
    } else {
      part = 'right ' + part;
    }
  }

  var damageTotal = damage;
  if (!melee) {
    if (part == 'noggin') {
      damageTotal = addToFirstType(damageTotal, 2);
    } else if (part == 'gizzards') {
      damageTotal = addToFirstType(damageTotal, 1);
    }
  }

  add('Hit the varmint in the ' + part + ', rolling ' + damageTotal + ' damage:');
  res = parseRoll(damageTotal, true);

  var wounds = Math.floor(res / 6.0); 
  var windDice = Math.max(1, wounds);

  res = parseRoll(windDice + 'd6', true);

  add('This causes ' + wounds + ' wounds to the ' + part + ', and ' + res + ' wind (assuming size 6 critter)');
  add('Light->Heavy->Serious->Critical->Maimed [Wind is 1d6 per wound, minimum 1d6]');
}

channel = undefined;
response = '';

client.on('message', message => {
  var content = message.content;
  channel = message.channel;
  if (content.substring(0, 1) == '!') {
    var raw = content.substring(1, content.length);
    var rest = raw.split(' ');
    if (rest[0] == 'fire') {
      //arguments = skill incriment range damage
      if (rest[1] == 'rifle') {
        fireRifle(rest[2], rest[3], rest[4], rest[5]);
        flush();
      } else if (rest[1] == 'shotgun') {
        fireShotgun(rest[2], rest[3], rest[4]);
        flush();
      } else if (rest[1] == 'fist') {
        fireFist(rest[2], rest[3], rest[4]);
        flush();
      } else {
        message.channel.send(rest[1] + ' is an undefined weapon');
      }
    } else if (rest[0] == 'help') {
      if (rest[1] == 'rifle') {
        message.channel.send('-->> !fire rifle <SKILL> <INCRIMENT> <RANGE> <DAMAGE>');
      } else if (rest[1] == 'shotgun') {
        message.channel.send('-->> !fire shotgun <SKILL> <INCRIMENT (probably 10)> <RANGE>');
      } else if (rest[1] == 'fist') {
        message.channel.send('-->> !fire fist <SKILL> <OPPONENT\'S SKILL> <DAMAGE>');
      } else {
        message.channel.send('Try !help <rifle|shotgun|fist> (the three genders)');
      }
    } else if (rest[0] == 'demo') { 
      if (rest[1] == 'rifle') {
        message.channel.send('!fire rifle 4d8 20 60 3d8');
      } else if (rest[1] == 'shotgun') {
        message.channel.send('!fire shotgun 4d8 10 30');
      } else if (rest[1] == 'fist') {
        message.channel.send('!fire fist 4d8 7 4d6');
      } else {
        message.channel.send('Try !demo <rifle|shotgun|fist> (the three genders)');
      }
    } else {
      message.channel.send('Command not understood: '+ raw);
    }
  } 
});

client.login('NjIzODc5NzEwNTA5NzYwNTQ1.XYI4CQ.gm7gFACFcGMI4yu2jhfW4k_bZhc');
