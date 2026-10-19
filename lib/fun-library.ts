export type FunTemplate = {
  id: string; title: string; kind: "meme" | "sticker"; category: string;
  top: string; bottom: string; emoji: string; color: string;
};
// Original captions and code-drawn artwork. No third-party meme image service.
export const funTemplates: FunTemplate[] = [
  {id:"group-plan",title:"The group finally has a plan",kind:"meme",category:"Friends",top:"WHEN THE GROUP CHAT",bottom:"FINALLY MAKES A PLAN",emoji:"🥳",color:"#21645b"},
  {id:"one-episode",title:"Just one more episode",kind:"meme",category:"Everyday",top:"ME: ONE MORE EPISODE",bottom:"ALSO ME: IS THAT THE SUN?",emoji:"🌅",color:"#684c91"},
  {id:"wifi-drama",title:"The Wi-Fi has other plans",kind:"meme",category:"Everyday",top:"I HAVE A VERY IMPORTANT POINT",bottom:"WI-FI: NOT TODAY",emoji:"📶",color:"#366a8b"},
  {id:"weekend-loading",title:"Weekend loading",kind:"meme",category:"Work & study",top:"MY BODY IS AT WORK",bottom:"MY BRAIN IS ALREADY SATURDAY",emoji:"🏖️",color:"#b85440"},
  {id:"study-break",title:"A very short study break",kind:"meme",category:"Work & study",top:"A FIVE-MINUTE STUDY BREAK",bottom:"THREE HOURS LATER…",emoji:"📚",color:"#886519"},
  {id:"small-small",title:"Small small, we go get there",kind:"meme",category:"Good vibes",top:"ONE SMALL WIN TODAY",bottom:"SMALL SMALL, WE GO GET THERE",emoji:"🌱",color:"#346b45"},
  {id:"typing-novel",title:"Someone is typing a novel",kind:"meme",category:"Friends",top:"THEY'VE BEEN TYPING FOR TEN MINUTES",bottom:"THE MESSAGE: OK",emoji:"👀",color:"#5a5b92"},
  {id:"food-arrived",title:"The food has arrived",kind:"meme",category:"Everyday",top:"MY MOOD FIVE SECONDS AGO",bottom:"MY MOOD WHEN THE FOOD ARRIVES",emoji:"🍲",color:"#9c562a"},
  {id:"no-wahala",title:"No wahala",kind:"sticker",category:"Good vibes",top:"NO WAHALA",bottom:"",emoji:"😎",color:"#21645b"},
  {id:"brain-buffering",title:"Brain buffering",kind:"sticker",category:"Work & study",top:"BRAIN BUFFERING…",bottom:"",emoji:"🤔",color:"#684c91"},
  {id:"on-my-way-ish",title:"On my way… ish",kind:"sticker",category:"Friends",top:"ON MY WAY… ISH",bottom:"",emoji:"🐢",color:"#346b45"},
  {id:"you-did-that",title:"You did that!",kind:"sticker",category:"Good vibes",top:"YOU DID THAT!",bottom:"",emoji:"🌟",color:"#886519"},
  {id:"team-sleep",title:"Team sleep",kind:"sticker",category:"Everyday",top:"TEAM SLEEP",bottom:"",emoji:"😴",color:"#366a8b"},
  {id:"i-hear-you",title:"I hear you",kind:"sticker",category:"Friends",top:"I HEAR YOU",bottom:"",emoji:"👂",color:"#b85440"},
  {id:"plot-twist",title:"Plot twist!",kind:"sticker",category:"Friends",top:"PLOT TWIST!",bottom:"",emoji:"😮",color:"#684c91"},
  {id:"tiny-victory",title:"Tiny victory dance",kind:"sticker",category:"Good vibes",top:"TINY VICTORY DANCE",bottom:"",emoji:"💃",color:"#9c562a"},
];
export type SavedCreation = {id:string; template:string|null; name:string; kind:"meme"|"sticker"; created:string};
