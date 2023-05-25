export class Manifest {
  constructor(options={}) {
    this.currentSeq = options.seq || options.defaultSeq;
    this.initialSeq = options.seq;
    delete options.seq;

    Object.assign(this, options);
    
    this.items = this.featureList;
    this.totalSeq = this.featureList.length;
    this.defaultSeq = parseInt(this.defaultSeq, 10);
    this.firstSeq = parseInt(this.firstSeq, 10);
    this.defaultImage = {
      height: parseInt(this.defaultImage.height, 10),
      width: parseInt(this.defaultImage.width, 10),
      rotation: 0
    };
    this.defaultImage.ratio = this.defaultImage.height / this.defaultImage.width;
    this.featureMap = {};
    this._seq2num = {};
    this._num2seq = {};
    this._pageNum = { first: null, last: null };
    this.featureList.forEach(function(item) {
      this.featureMap[item.seq] = item;
      if ( item.pageNum && ! this._seq2num[item.seq] ) {
        this._seq2num[item.seq] = item.pageNum;
        this._num2seq[item.pageNum] = item.seq;
        if ( this._pageNum.first == null ) { this._pageNum.first = item.pageNum; }
        this._pageNum.last = item.pageNum;
      }
    }.bind(this))

    this.manifest = {};
  }

  update(seq, meta) {
    if ( meta.rotation != null && meta.width === undefined ) {
      // just updating rotation
      this.manifest[seq].rotation = meta.rotation;
      return;
    }
    if ( meta.resolution != null && meta.width === undefined ) {
      this.manifest[seq].resolution = meta.resolution;
      return;
    }
    // ... which will help with switching lanes and rotating
    if ( this.manifest[seq] && this.manifest[seq].width ) { return ; }
    const ratio = this.defaultImage.width / meta.width;
    this.manifest[seq] = {
      width: this.defaultImage.width,
      height: meta.height * ratio,
      rotation: meta.rotation || 0,
      ratio: meta.height / meta.width,
      resolution: meta.resolution,
      size: meta.size
    }
  }

  meta(seq) {
    if ( this.manifest[seq] ) {
      const meta = this.manifest[seq];
      if ( meta.rotation % 180 != 0 ) {
        return { height: meta.width, width: meta.height, rotation: meta.rotation };
      }
      return meta;
    }
    return this.defaultImage;
  }

  rotateBy(seq, delta) {
    let rotation;
    // this shouldn't happen
    if ( ! this.manifest[seq] ) { return; }
    rotation = this.manifest[seq].rotation;
    if ( rotation == 0 ) { rotation = 360; }
    rotation += delta;
    rotation = rotation % 360;
    this.manifest[seq].rotation = rotation;
  }

  checkFeatures(seq, feature) {
    const data = this.featureMap[seq];
    if ( data && data.features ) {
      if ( feature === undefined ) { return data.features.length > 1 };
      return ( data.features.indexOf(feature) > -1 );
    }
    return false;
  }

  ownerid(seq) {
    const data = this.featureMap[seq];
    if ( data && data.ownerid ) {
      return data.ownerid;
    }
    return null;
  }

  physicalSeq(seq) {
    const data = this.featureMap[seq];
    if ( data && data.pseq ) {
      return data.pseq;
    }
    return seq;
  }

  pageNum(seq, prefixed=true) {
    let value = this._seq2num[seq];
    if ( value ) { 
      if ( prefixed ) {
        value = `p.${value}`; 
      }
      return value; 
    }
    return null;
  }

  pageNumRange() {
    if ( this._pageNum.first == null ) { return null; }
    return `${this._pageNum.first}-${this._pageNum.last}`;
  }

  hasPageNum() {
    return ! ( this._pageNum.first == null );
  }

  seq(pageNum) {
    return this._num2seq[pageNum] || pageNum;
  }

  hasFrontCover() {
    return (
      this.checkFeatures(1, "FRONT_COVER") || 
      (
        this.checkFeatures(1, "COVER") && this.checkFeatures(1, "RIGHT")
      ) || 
      this.checkFeatures(1, "COVER") || 
      ! this.checkFeatures(1)
    );
  }

  hasBackCover() {
    return ( 
      this.checkFeatures(this.totalSeq, "BACK_COVER") || 
      (
        this.checkFeatures(this.totalSeq, "COVER") && this.checkFeatures(this.totalSeq, "LEFT") 
      ) 
    );
  }
}